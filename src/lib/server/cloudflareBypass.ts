import axios from 'axios';
import * as http from 'http';
import * as https from 'https';

const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'http://127.0.0.1:21674/v1';

// Per-domain cookie storage so easychan and mokachan don't bleed into each other
const cookieStore = new Map<string, string[]>();
let cachedUserAgent = '';

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

    console.log(`[Image Proxy] Fetching: ${url}${cookieHeader ? ' (with cookies)' : ''}`);
    return fetchDirect(url, userAgent, referer, cookieHeader);
}

function fetchDirect(url: string, userAgent: string, referer: string, cookieHeader: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
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
        }, (res) => {
            // Follow redirects
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchDirect(res.headers.location, userAgent, referer, cookieHeader)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            const chunks: Buffer[] = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                } else {
                    resolve(Buffer.concat(chunks));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy(new Error(`Timeout fetching ${url}`));
        });
        req.end();
    });
}

/**
 * No-op kept for backward compatibility with proxy route.
 * SSH tunnels have been removed since FlareSolverr runs on localhost.
 */
export async function keepTunnelAlive(): Promise<void> {
    // No-op: FlareSolverr is on localhost, no tunnel needed
}

/**
 * Fetch a URL via FlareSolverr (for Cloudflare-protected pages).
 * FlareSolverr runs locally at http://127.0.0.1:21674/v1.
 * Returns parsed JSON.
 */
export async function fetchWithFlareSolverr(url: string): Promise<any> {
    console.log(`[FlareSolverr] Fetching: ${url}`);
    const domain = getDomainFromUrl(url);

    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`[FlareSolverr] Attempt ${attempt}/3...`);
            const response = await axios.post(
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
                const cookieStrings = cookies.map((c: any) => `${c.name}=${c.value}`);
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
        } catch (error: any) {
            console.error(`[FlareSolverr] Attempt ${attempt} failed:`, error.message || error);
            lastError = error;
            if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    throw lastError;
}

/**
 * Fetch JSON from a meguca-style board API directly (no Cloudflare bypass).
 * Used for mokachan and any future meguca sites without Cloudflare challenges.
 */
export async function fetchMegucaJson(url: string): Promise<any> {
    console.log(`[Meguca] Fetching directly: ${url}`);
    const domain = getDomainFromUrl(url);

    const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': `https://${domain}/`,
    };

    const response = await axios.get(url, { headers, timeout: 30000 });
    return response.data;
}
