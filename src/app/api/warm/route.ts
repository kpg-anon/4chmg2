import { NextRequest, NextResponse } from 'next/server';
import { fetchImage } from '@/lib/server/cloudflareBypass';
import { cacheMedia, isCached } from '@/lib/server/mediaCache';

// Mirror of the proxy route's allowlist. Kept inline so warm and proxy never
// drift in lockstep — if you add a hostname to one, add it to the other.
const ALLOWED_HOSTNAMES = new Set([
    'i.4cdn.org',
    'is2.4chan.org',
    'easychan.net',
    'mokachan.cafe',
    'desuarchive.org',
    'desu-usergeneratedcontent.xyz',
    '2ch.org',
]);

function isAllowedUrl(url: string): boolean {
    try {
        const { hostname } = new URL(url);
        return ALLOWED_HOSTNAMES.has(hostname) ||
            [...ALLOWED_HOSTNAMES].some(h => hostname.endsWith(`.${h}`));
    } catch {
        return false;
    }
}

// Concurrency limit for background warmup. Keeps us well under the agent's
// per-host socket budget and avoids tripping any upstream rate-limit while
// the user is also pulling visible thumbs at high priority.
const WARM_CONCURRENCY = 4;
const MAX_URLS_PER_REQUEST = 500;

// In-flight de-dup: if two clients ask to warm the same URL, fetch once.
const inflight = new Set<string>();

async function warmOne(url: string): Promise<void> {
    if (inflight.has(url)) return;
    if (await isCached(url)) return;
    inflight.add(url);
    try {
        const buffer = await fetchImage(url);
        await cacheMedia(url, buffer);
    } catch (e) {
        // Best-effort; failures here just mean the next proxy request pays the cost.
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[Warm] ${url}: ${msg}`);
    } finally {
        inflight.delete(url);
    }
}

async function warmAll(urls: string[]): Promise<{ queued: number; skipped: number }> {
    const allowed = urls.filter(isAllowedUrl);
    const skipped = urls.length - allowed.length;
    const queue = [...allowed];
    let queued = 0;

    const workers = Array.from({ length: WARM_CONCURRENCY }, async () => {
        while (queue.length) {
            const url = queue.shift();
            if (!url) break;
            queued++;
            await warmOne(url);
        }
    });
    await Promise.all(workers);
    return { queued, skipped };
}

export async function POST(request: NextRequest) {
    let body: { urls?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'invalid json' }, { status: 400 });
    }

    const urls = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === 'string') : [];
    if (!urls.length) {
        return NextResponse.json({ queued: 0, skipped: 0 });
    }
    if (urls.length > MAX_URLS_PER_REQUEST) {
        return NextResponse.json({ error: `too many urls (max ${MAX_URLS_PER_REQUEST})` }, { status: 413 });
    }

    // Fire-and-forget: respond immediately so the client isn't blocked while
    // the server fans out fetches. Errors are logged inside warmOne.
    void warmAll(urls);
    return NextResponse.json({ accepted: urls.length });
}
