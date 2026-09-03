import { fetchImage } from '@/lib/server/cloudflareBypass';
import { desuGet } from '@/lib/server/desuLimiter';

/**
 * Recover 4chan media that the CDN no longer serves.
 *
 * 4chan prunes files well before a thread scrolls off, and janitors delete
 * individual posts, so a live thread routinely contains tiles whose image is a
 * hard 404 on i.4cdn.org. Desuarchive mirrors those boards, so the proxy can
 * transparently swap in the archived bytes instead of showing a broken tile.
 */

const DESU_CDN = 'https://desu-usergeneratedcontent.xyz';
const DESU_API = 'https://desuarchive.org/_/api/chan/post/';

// https://i.4cdn.org/<board>/<tim>.<ext>  — full media
// https://i.4cdn.org/<board>/<tim>s.jpg   — thumbnail
const FOURCHAN_MEDIA = /^https?:\/\/i\.4cdn\.org\/([a-z0-9]+)\/(\d{6,})(s)?(\.\w+)$/i;

interface FourchanMediaRef {
    board: string;
    tim: string;
    ext: string;
    isThumb: boolean;
}

interface DesuPostResponse {
    media?: {
        media_link?: string;
        remote_media_link?: string;
        thumb_link?: string;
    };
}

function parseFourchanMedia(url: string): FourchanMediaRef | null {
    const match = FOURCHAN_MEDIA.exec(url);
    if (!match) return null;
    return { board: match[1].toLowerCase(), tim: match[2], ext: match[4], isThumb: Boolean(match[3]) };
}

/**
 * FoolFuuka shards media by the first four and next two digits of the original
 * 4chan timestamp, so the archived URL is derivable with no API call. This is
 * right roughly 70% of the time: the archive stores one copy per content hash,
 * so a repost's link points at whichever upload was archived first. Those need
 * the post lookup below.
 */
function derivedUrl(ref: FourchanMediaRef): string {
    const dir = `${ref.tim.slice(0, 4)}/${ref.tim.slice(4, 6)}`;
    return ref.isThumb
        ? `${DESU_CDN}/${ref.board}/thumb/${dir}/${ref.tim}s.jpg`
        : `${DESU_CDN}/${ref.board}/image/${dir}/${ref.tim}${ref.ext}`;
}

/** Exact resolution via the archive's post record — handles reposts/dedup. */
async function lookupArchivedUrl(ref: FourchanMediaRef, postNum: string): Promise<string | null> {
    try {
        // Shares the archive's rate-limit budget with search and thread fetches:
        // a grid full of dead 4chan tiles would otherwise burst hundreds of post
        // lookups and starve whatever search is running.
        const data = await desuGet<DesuPostResponse>(
            `${DESU_API}?board=${ref.board}&num=${postNum}`,
            { timeout: 15_000 },
        );
        const media = data?.media;
        if (!media) return null;
        const link = ref.isThumb ? media.thumb_link : (media.media_link || media.remote_media_link);
        return link || null;
    } catch {
        return null;
    }
}

// Remember what each dead URL resolved to (including "nothing", so a board the
// archive doesn't cover isn't re-queried on every tile). Bounded and short-lived
// because a resolution can start succeeding once the archive catches up.
// `triedLookup` records whether that attempt had a post hint: warm-up runs
// without one, and a cached miss from those must not block the exact lookup a
// later hinted request can still do.
const RESOLVE_TTL_MS = 10 * 60_000;
const RESOLVE_CACHE_MAX = 5_000;

interface Resolution {
    archived: string | null;
    triedLookup: boolean;
    at: number;
}

const resolveCache = new Map<string, Resolution>();

function rememberResolution(url: string, archived: string | null, triedLookup: boolean): void {
    if (resolveCache.size >= RESOLVE_CACHE_MAX) resolveCache.clear();
    resolveCache.set(url, { archived, triedLookup, at: Date.now() });
}

async function tryFetch(url: string): Promise<Buffer | null> {
    try {
        return await fetchImage(url);
    } catch {
        return null;
    }
}

/**
 * Fetch the archived copy of a dead 4chan media URL.
 *
 * `postNum` is the 4chan post number the media belongs to; the client passes it
 * as a hint so reposts resolve exactly. Returns null when the URL isn't 4chan
 * media, the board isn't archived, or the archive has no copy either.
 */
export async function fetchFromDesuarchive(
    url: string,
    postNum?: string | null,
): Promise<{ buffer: Buffer; source: string } | null> {
    const ref = parseFourchanMedia(url);
    if (!ref) return null;

    const cached = resolveCache.get(url);
    const memo = cached && Date.now() - cached.at < RESOLVE_TTL_MS ? cached : null;

    if (memo?.archived) {
        const buffer = await tryFetch(memo.archived);
        return buffer ? { buffer, source: memo.archived } : null;
    }

    const hint = postNum && /^\d+$/.test(postNum) ? postNum : null;
    // A remembered miss is final unless this request carries a post hint the
    // one that recorded it didn't have.
    if (memo && (memo.triedLookup || !hint)) return null;

    let archived: string | null = null;
    let buffer: Buffer | null = null;

    // Skip the derived guess when a previous attempt already proved it wrong.
    if (!memo) {
        archived = derivedUrl(ref);
        buffer = await tryFetch(archived);
    }

    if (!buffer && hint) {
        const exact = await lookupArchivedUrl(ref, hint);
        if (exact && exact !== archived) {
            archived = exact;
            buffer = await tryFetch(archived);
        }
    }

    rememberResolution(url, buffer ? archived : null, Boolean(hint));
    return buffer && archived ? { buffer, source: archived } : null;
}
