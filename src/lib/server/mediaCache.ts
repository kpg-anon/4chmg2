import { createHash } from 'crypto';
import { existsSync, mkdirSync, createReadStream, statSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { Readable } from 'stream';

const CACHE_DIR = join(process.cwd(), '.media-cache');

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
    } catch (e) {
        console.error('[MediaCache] Failed to write cache:', e);
    }
}

export function getCacheFilePath(url: string): string {
    return getCachePath(url);
}
