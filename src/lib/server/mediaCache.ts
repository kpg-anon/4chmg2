import { createHash } from 'crypto';
import { existsSync, mkdirSync, createReadStream, statSync } from 'fs';
import { readFile, writeFile, mkdir, readdir, stat, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { Readable } from 'stream';

const CACHE_DIR = join(process.cwd(), '.media-cache');

// Cap the disk cache so aggressive prefetch can't fill a 50 GB VPS. The OS
// page cache + nginx's 5 GB layer sit in front of this, so even a modest cap
// gives effectively-instant repeat fetches for hot content.
const MAX_CACHE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
const EVICT_TARGET_BYTES = 8 * 1024 * 1024 * 1024; // drop to 8 GB on overflow
const CACHE_CHECK_EVERY_N_WRITES = 250;

let writesSinceCheck = 0;
let evictionInFlight = false;

// Ensure base cache dir exists at startup
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

function getCachePath(url: string): string {
    const hash = createHash('sha256').update(url).digest('hex');
    return join(CACHE_DIR, hash.slice(0, 2), hash + getExtFromUrl(url));
}

function getExtFromUrl(url: string): string {
    const match = url.match(/(\.\w+)(?:\?|$)/);
    return match ? match[1] : '';
}

export async function getCachedMedia(url: string): Promise<{ buffer: Buffer; size: number } | null> {
    const path = getCachePath(url);
    try {
        const buffer = await readFile(path);
        return { buffer, size: buffer.length };
    } catch {
        return null;
    }
}

export async function getCachedMediaStream(url: string, start?: number, end?: number): Promise<{ stream: Readable; size: number; totalSize: number } | null> {
    const path = getCachePath(url);
    try {
        const stat = statSync(path);
        const totalSize = stat.size;
        const opts = start !== undefined || end !== undefined
            ? { start: start ?? 0, end: end ?? totalSize - 1 }
            : undefined;
        const stream = createReadStream(path, opts);
        const size = opts ? (opts.end - opts.start + 1) : totalSize;
        return { stream, size, totalSize };
    } catch {
        return null;
    }
}

export async function cacheMedia(url: string, buffer: Buffer): Promise<void> {
    const path = getCachePath(url);
    const dir = dirname(path);
    try {
        await mkdir(dir, { recursive: true });
        await writeFile(path, buffer);
        writesSinceCheck++;
        if (writesSinceCheck >= CACHE_CHECK_EVERY_N_WRITES) {
            writesSinceCheck = 0;
            void maybeEvict();
        }
    } catch (e) {
        console.error('[MediaCache] Failed to write cache:', e);
    }
}

export async function isCached(url: string): Promise<boolean> {
    try {
        statSync(getCachePath(url));
        return true;
    } catch {
        return false;
    }
}

// LRU-ish eviction by mtime when the on-disk cache grows past MAX_CACHE_BYTES.
// Single-flight so concurrent writes don't all kick off a walk at once.
async function maybeEvict(): Promise<void> {
    if (evictionInFlight) return;
    evictionInFlight = true;
    try {
        const files = await listCacheFiles();
        let total = 0;
        for (const f of files) total += f.size;
        if (total <= MAX_CACHE_BYTES) return;

        files.sort((a, b) => a.mtimeMs - b.mtimeMs); // oldest first
        let freed = 0;
        const toFree = total - EVICT_TARGET_BYTES;
        for (const f of files) {
            if (freed >= toFree) break;
            try {
                await unlink(f.path);
                freed += f.size;
            } catch { /* file already gone */ }
        }
        console.log(`[MediaCache] Evicted ${(freed / 1024 / 1024).toFixed(1)} MB (was ${(total / 1024 / 1024).toFixed(1)} MB)`);
    } catch (e) {
        console.error('[MediaCache] Eviction failed:', e);
    } finally {
        evictionInFlight = false;
    }
}

interface CacheFile { path: string; size: number; mtimeMs: number; }

async function listCacheFiles(): Promise<CacheFile[]> {
    const out: CacheFile[] = [];
    let shards: string[];
    try {
        shards = await readdir(CACHE_DIR);
    } catch {
        return out;
    }
    for (const shard of shards) {
        const shardPath = join(CACHE_DIR, shard);
        let entries: string[];
        try {
            entries = await readdir(shardPath);
        } catch { continue; }
        for (const name of entries) {
            const p = join(shardPath, name);
            try {
                const s = await stat(p);
                if (s.isFile()) out.push({ path: p, size: s.size, mtimeMs: s.mtimeMs });
            } catch { /* race with eviction */ }
        }
    }
    return out;
}

export function getCacheFilePath(url: string): string {
    return getCachePath(url);
}
