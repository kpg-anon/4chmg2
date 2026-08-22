import { NextResponse } from 'next/server';
import axios from 'axios';
import { BOARDS, SITE_TEMPLATES, type BoardConfig, type BoardSource } from '@/lib/boards';

/**
 * Liveness probe for the upstream sources shown on the homepage.
 *
 * The panel used to infer health from each site's favicon fetched through
 * /api/proxy. That measured the wrong thing twice over: desuarchive serves
 * /favicon.ico behind a Cloudflare browser challenge (403 to any server-side
 * client) while its API answers normally, and the proxy's disk cache has no
 * TTL — so a favicon fetched once stayed "OK" long after the probe itself had
 * started failing. Hosts with a warm cache reported green, hosts without it
 * reported red, and neither reflected whether the source actually worked.
 *
 * Instead we HEAD the endpoint each source is really consumed through, so the
 * dot tracks the capability the user cares about: can we still pull threads?
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const PROBE_TIMEOUT_MS = 8000;

// Upstreams are shared by every visitor, so probe results are memoised process
// wide rather than per request — a busy homepage must not turn into a spike of
// HEADs against sources that are already struggling.
const CACHE_TTL_MS = 60_000;

export type SourceState = 'ok' | 'down';

interface CachedResult {
    at: number;
    states: Record<string, SourceState>;
}

let cached: CachedResult | null = null;
let inFlight: Promise<Record<string, SourceState>> | null = null;

/** First configured board for a source — probes follow real traffic, not a guess. */
function representativeBoard(source: BoardSource): BoardConfig | undefined {
    return BOARDS.find(b => b.source === source);
}

/**
 * Mirror the URL each source is actually fetched through:
 * catalog/route.ts for 4chan, meguca and dvach; desuthread/route.ts for the
 * foolfuuka archive. Anything else has no known probe and is skipped.
 */
function probeUrl(source: BoardSource): string | null {
    const board = representativeBoard(source);
    if (!board) return null;

    if (source === 'desuarchive') {
        // Board root rather than a post lookup: no search rate limit, and it
        // exercises the same /_/api surface the thread and search routes use.
        return `${board.baseUrl}/_/api/chan/thread/?board=${board.id}&num=1`;
    }
    if (board.isMeguca) {
        return `${board.baseUrl}/json/boards/${board.id}/catalog`;
    }
    return `${board.baseUrl}/${board.id}/catalog.json`;
}

async function probe(url: string): Promise<SourceState> {
    // HEAD keeps the check free of a payload; a few CDNs answer 405 to it, so
    // fall back to GET before believing a source is down.
    for (const method of ['head', 'get'] as const) {
        try {
            const res = await axios.request({
                url,
                method,
                headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
                timeout: PROBE_TIMEOUT_MS,
                validateStatus: () => true,
                // Enough to confirm the endpoint answers without pulling a catalog.
                maxContentLength: 64 * 1024,
                maxBodyLength: 64 * 1024,
            });
            if (res.status < 400) return 'ok';
            if (method === 'head' && (res.status === 405 || res.status === 501)) continue;
            return 'down';
        } catch {
            if (method === 'head') continue;
            return 'down';
        }
    }
    return 'down';
}

async function probeAll(): Promise<Record<string, SourceState>> {
    const sites = Object.values(SITE_TEMPLATES);
    const entries = await Promise.all(
        sites.map(async site => {
            const url = probeUrl(site.source);
            if (!url) return [site.id, 'down' as SourceState] as const;
            const state = await probe(url);
            if (state === 'down') console.warn(`[Status] ${site.id} probe failed: ${url}`);
            return [site.id, state] as const;
        })
    );
    return Object.fromEntries(entries);
}

export const dynamic = 'force-dynamic';

export async function GET() {
    const now = Date.now();
    if (cached && now - cached.at < CACHE_TTL_MS) {
        return NextResponse.json(cached.states, {
            headers: { 'Cache-Control': 'no-store' },
        });
    }

    // Single-flight: concurrent first hits share one round of probes.
    if (!inFlight) {
        inFlight = probeAll()
            .then(states => {
                cached = { at: Date.now(), states };
                return states;
            })
            .finally(() => { inFlight = null; });
    }

    try {
        const states = await inFlight;
        return NextResponse.json(states, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
        // Never fail the panel outright — an unreachable prober is itself a
        // signal, so report everything unknown-but-served rather than a 500.
        const states = Object.fromEntries(
            Object.values(SITE_TEMPLATES).map(s => [s.id, 'down' as SourceState])
        );
        return NextResponse.json(states, { headers: { 'Cache-Control': 'no-store' } });
    }
}
