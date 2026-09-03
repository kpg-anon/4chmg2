import axios, { type AxiosRequestConfig } from 'axios';

/**
 * Serialised, retrying access to desuarchive's API.
 *
 * Desuarchive rate-limits per client IP and answers 429 once a burst gets too
 * wide. The gallery opens N threads at once, so an 11-thread archive search used
 * to fire 11 parallel requests and lose roughly half of them — each failed fetch
 * silently became an empty media list, so the page rendered a partial batch that
 * looked like "the archive only has this much". Measured against the live API: a
 * burst of 4 succeeds, a burst of 11 loses 5-6.
 *
 * Every server-side call to desuarchive.org goes through `desuGet` so the whole
 * process shares one budget — thread fetches, search paging, and the proxy's
 * dead-media lookups can't starve each other.
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Sized below the burst that starts drawing 429s, with a gap between starts so a
// queue drained back-to-back doesn't itself look like a burst.
const MAX_CONCURRENT = 3;
const MIN_GAP_MS = 120;

// 429 is a "come back later", not a failure: retrying is what turns a dropped
// thread into a slightly slower one. Backoff is exponential with jitter so
// queued retries don't resynchronise into another burst.
const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 800;

let active = 0;
let lastStart = 0;
const waiting: (() => void)[] = [];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function acquire(): Promise<void> {
    if (active >= MAX_CONCURRENT) {
        await new Promise<void>(resolve => waiting.push(resolve));
    }
    active++;
    const gap = MIN_GAP_MS - (Date.now() - lastStart);
    if (gap > 0) await sleep(gap);
    lastStart = Date.now();
}

function release(): void {
    active--;
    waiting.shift()?.();
}

function isRetryable(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return false;
    const status = error.response?.status;
    // No response at all means a timeout or a dropped connection, which the
    // archive also does under load.
    if (status === undefined) return true;
    return status === 429 || status === 503 || status === 502 || status === 504;
}

/** Honour Retry-After when the archive sends one, else exponential backoff. */
function backoffFor(error: unknown, attempt: number): number {
    const header = axios.isAxiosError(error) ? error.response?.headers?.['retry-after'] : undefined;
    const seconds = typeof header === 'string' ? parseInt(header, 10) : NaN;
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 15_000);
    return BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 400;
}

export async function desuGet<T = unknown>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        await acquire();
        try {
            const response = await axios.get<T>(url, {
                timeout: 30_000,
                ...config,
                headers: {
                    'User-Agent': USER_AGENT,
                    Accept: 'application/json',
                    ...config.headers,
                },
            });
            return response.data;
        } catch (error) {
            lastError = error;
            if (!isRetryable(error) || attempt === MAX_ATTEMPTS - 1) throw error;
        } finally {
            release();
        }

        // Backoff happens outside the slot so a waiting request can use it.
        await sleep(backoffFor(lastError, attempt));
    }

    throw lastError;
}
