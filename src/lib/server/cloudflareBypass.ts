import axios from 'axios';
import * as http from 'http';
import * as https from 'https';

// Pool sized for burst scrolling + parallel cache warmup. Each board's CDN
// gets its own per-host queue inside the agent, so 64 total ≈ ~16 per host
// across the 4 active CDNs without hammering any single one.
const httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 64,
    maxFreeSockets: 16,
    timeout: 30000,
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 64,
    maxFreeSockets: 16,
    timeout: 30000,
});

const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'http://127.0.0.1:8191/v1';

/**
 * Upstream responded with a >=400 status. Carries the status so callers can
 * branch on it — the proxy only falls back to the archive on a 404.
 */
export class UpstreamHttpError extends Error {
    constructor(public readonly status: number, public readonly url: string) {
        super(`HTTP ${status} for ${url}`);
        this.name = 'UpstreamHttpError';
    }
}

/**
 * The transfer never finished in time. Two distinct shapes, both retryable:
 * - `stalled`   — the socket went silent for INACTIVITY_MS mid-body.
 * - `deadline`  — bytes kept trickling but the whole attempt blew its budget.
 *
 * Both are needed. A pure inactivity timer does not bound a slow transfer: a
 * 2026-09-04 incident had 2ch.org dribbling a 3 MB mp4 for 265 s (resetting a
 * 30 s inactivity timer over and over) before going quiet, which blew nginx's
 * 120 s proxy_read_timeout long before this layer gave up.
 */
export class UpstreamTimeoutError extends Error {
    constructor(public readonly url: string, public readonly reason: 'stalled' | 'deadline') {
        super(reason === 'stalled'
            ? `Stalled (no data for ${INACTIVITY_MS}ms) fetching ${url}`
            : `Deadline (${DEADLINE_MS}ms) exceeded fetching ${url}`);
        this.name = 'UpstreamTimeoutError';
    }
}

// Budget per attempt. Three attempts plus backoff worst-cases at ~92 s, which
// stays under nginx's 120 s proxy_read_timeout so a slow fetch surfaces as our
// own error (and the archive fallback) rather than a bare 504 from nginx.
const INACTIVITY_MS = 10_000;
const DEADLINE_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [500, 1500];

const RETRYABLE_CODES = new Set([
    'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE',
    'EAI_AGAIN', 'ENOTFOUND', 'ECONNABORTED', 'EHOSTUNREACH',
]);

/**
 * GET is idempotent, so anything that looks like a transport hiccup is worth
 * another shot. 4xx deliberately is not: a 404 has to fall straight through to
 * the archive fallback, and retrying a 403 just burns the budget.
 */
function isRetryable(error: unknown): boolean {
    if (error instanceof UpstreamTimeoutError) return true;
    if (error instanceof UpstreamHttpError) return error.status >= 500;
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code && RETRYABLE_CODES.has(code)) return true;
    return error instanceof Error && /socket hang up/i.test(error.message);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Per-domain cookie storage so easychan and mokachan don't bleed into each other
const cookieStore = new Map<string, string[]>();
let cachedUserAgent = '';

interface FlareSolverrCookie {
    name: string;
    value: string;
}

interface FlareSolverrResponse {
    status: string;
    message?: string;
    solution: {
        cookies?: FlareSolverrCookie[];
        userAgent?: string;
        response: string;
    };
}

function getDomainFromUrl(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}

function getCookiesForDomain(domain: string): string {
    const cookies = cookieStore.get(domain);
    if (!cookies || cookies.length === 0) return '';
    return cookies.join('; ');
}

function setCookiesForDomain(domain: string, cookies: string[]): void {
    cookieStore.set(domain, cookies);
    console.log(`[Cookies] Cached ${cookies.length} cookies for ${domain}`);
}

/**
 * Determine if a URL needs Cloudflare bypass cookies.
 * Currently only easychan.net assets need them.
 */
function urlNeedsBypassCookies(url: string): boolean {
    return url.includes('easychan.net');
}

/**
 * Fetch an image/video buffer from a URL.
 * Routes through the appropriate strategy based on the URL domain:
 * - easychan.net: includes cached FlareSolverr cookies
 * - mokachan.cafe: direct fetch, proper Referer
 * - 4chan CDN: direct fetch, NO Cookie header (4cdn.org rejects empty Cookie headers)
 */
export async function fetchImage(url: string): Promise<Buffer> {
    const domain = getDomainFromUrl(url);
    const needsCookies = urlNeedsBypassCookies(url);
    const cookieHeader = needsCookies ? getCookiesForDomain(domain) : '';
    const userAgent = cachedUserAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    // Determine the correct Referer
    let referer = 'https://boards.4chan.org/';
    if (url.includes('easychan.net')) referer = 'https://easychan.net/';
    else if (url.includes('mokachan.cafe')) referer = 'https://mokachan.cafe/';
    else if (url.includes('2ch.org')) referer = 'https://2ch.org/';

    console.log(`[Image Proxy] Fetching: ${url}${cookieHeader ? ' (with cookies)' : ''}`);

    // 2ch.org's origin stalls intermittently on full-size files that miss
    // Cloudflare's edge cache; the retry almost always lands on a warm edge and
    // returns in milliseconds. Without it a single stall became a hard 500,
    // because the archive fallback in the proxy only triggers on a 404.
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            return await fetchDirect(url, userAgent, referer, cookieHeader);
        } catch (error: unknown) {
            lastError = error;
            if (attempt === MAX_ATTEMPTS || !isRetryable(error)) break;
            const delay = RETRY_BACKOFF_MS[attempt - 1];
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(`[Image Proxy] Attempt ${attempt}/${MAX_ATTEMPTS} failed (${msg}) — retrying in ${delay}ms`);
            await sleep(delay);
        }
    }
    throw lastError;
}

const MAX_REDIRECTS = 5;

function fetchDirect(
    url: string,
    userAgent: string,
    referer: string,
    cookieHeader: string,
    depth: number = 0,
    deadlineAt: number = Date.now() + DEADLINE_MS,
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        if (depth >= MAX_REDIRECTS) {
            reject(new Error(`Too many redirects fetching ${url}`));
            return;
        }

        // Redirects share one budget with the original request, so a chain
        // can't quietly multiply the deadline by MAX_REDIRECTS.
        const msLeft = deadlineAt - Date.now();
        if (msLeft <= 0) {
            reject(new UpstreamTimeoutError(url, 'deadline'));
            return;
        }

        let deadlineTimer: NodeJS.Timeout | undefined;
        let settled = false;
        const settle = (fn: () => void) => {
            if (settled) return;
            settled = true;
            if (deadlineTimer) clearTimeout(deadlineTimer);
            fn();
        };
        const succeed = (buffer: Buffer) => settle(() => resolve(buffer));
        const fail = (error: Error) => settle(() => reject(error));

        const isHttps = url.startsWith('https://');
        const headers: Record<string, string> = {
            'User-Agent': userAgent,
            'Referer': referer,
            'Accept': '*/*',
        };
        // CRITICAL: Only include Cookie header when we actually have cookies.
        // 4chan CDN returns 403 if an empty Cookie header is sent.
        if (cookieHeader) {
            headers['Cookie'] = cookieHeader;
        }

        const req = (isHttps ? https : http).request(url, {
            method: 'GET',
            headers,
            agent: isHttps ? httpsAgent : httpAgent,
        }, (res) => {
            // Follow redirects
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Drain the redirect body first. An unconsumed response keeps
                // its socket checked out of the keep-alive agent forever, so
                // every redirect would otherwise burn one of the 64 sockets
                // for that host until the pool ran dry.
                res.resume();

                let location = res.headers.location;
                // Resolve relative redirect URLs against the current URL
                if (!location.startsWith('http://') && !location.startsWith('https://')) {
                    try {
                        location = new URL(location, url).href;
                    } catch {
                        fail(new Error(`Invalid redirect location: ${location}`));
                        return;
                    }
                }
                // Hand the remaining budget to the follow-up and stand down, so
                // this request's timer can't fire against an orphaned socket.
                if (deadlineTimer) {
                    clearTimeout(deadlineTimer);
                    deadlineTimer = undefined;
                }
                fetchDirect(location, userAgent, referer, cookieHeader, depth + 1, deadlineAt)
                    .then(succeed)
                    .catch(fail);
                return;
            }

            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('error', fail);
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400) {
                    fail(new UpstreamHttpError(res.statusCode, url));
                } else {
                    succeed(Buffer.concat(chunks));
                }
            });
        });

        req.on('error', fail);
        // Inactivity: the socket went silent mid-transfer.
        req.setTimeout(INACTIVITY_MS, () => {
            req.destroy(new UpstreamTimeoutError(url, 'stalled'));
        });
        // Overall: bytes are arriving, just far too slowly to be worth waiting on.
        deadlineTimer = setTimeout(() => {
            req.destroy(new UpstreamTimeoutError(url, 'deadline'));
        }, msLeft);
        req.end();
    });
}

/**
 * Fetch a URL via FlareSolverr (for Cloudflare-protected pages).
 * FlareSolverr runs locally at http://127.0.0.1:8191/v1.
 * Returns parsed JSON.
 */
export async function fetchWithFlareSolverr(url: string): Promise<unknown> {
    console.log(`[FlareSolverr] Fetching: ${url}`);
    const domain = getDomainFromUrl(url);

    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`[FlareSolverr] Attempt ${attempt}/3...`);
            const response = await axios.post<FlareSolverrResponse>(
                FLARESOLVERR_URL,
                {
                    cmd: 'request.get',
                    url: url,
                    maxTimeout: 60000,
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 65000,
                }
            );

            if (response.data.status !== 'ok') {
                throw new Error(`FlareSolverr error: ${response.data.message || 'Unknown error'}`);
            }

            // Cache cookies per domain
            const cookies = response.data.solution.cookies || [];
            if (cookies.length > 0) {
                const cookieStrings = cookies.map((cookie) => `${cookie.name}=${cookie.value}`);
                setCookiesForDomain(domain, cookieStrings);
            }

            const userAgent = response.data.solution.userAgent;
            if (userAgent) {
                cachedUserAgent = userAgent;
                console.log('[FlareSolverr] Cached user agent');
            }

            const content = response.data.solution.response;

            // FlareSolverr sometimes wraps JSON in <pre> tags
            let jsonContent = content;
            if (content.includes('<pre>')) {
                const match = content.match(/<pre>([\s\S]*?)<\/pre>/);
                if (match) jsonContent = match[1];
            }

            try {
                const json = JSON.parse(jsonContent);
                console.log('[FlareSolverr] Success.');
                return json;
            } catch {
                console.error('[FlareSolverr] Failed to parse JSON. Preview:', jsonContent.substring(0, 200));
                throw new Error('Response was not valid JSON');
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error(`[FlareSolverr] Attempt ${attempt} failed:`, msg);
            lastError = error;
            if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    throw (lastError instanceof Error ? lastError : new Error(String(lastError)));
}

/**
 * Fetch JSON from a meguca-style board API directly (no Cloudflare bypass).
 * Used for mokachan and any future meguca sites without Cloudflare challenges.
 */
export async function fetchMegucaJson(url: string): Promise<unknown> {
    console.log(`[Meguca] Fetching directly: ${url}`);
    const domain = getDomainFromUrl(url);

    const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': `https://${domain}/`,
    };

    const response = await axios.get(url, { headers, timeout: 30000, httpsAgent });
    return response.data;
}
