import { getBoardByKey, type BoardSource } from '@/lib/boards';

// ─── Cache ───────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30_000; // 30 seconds

function getCached(key: string): any | null {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
        return entry.data;
    }
    cache.delete(key);
    return null;
}

function setCache(key: string, data: any): void {
    cache.set(key, { data, timestamp: Date.now() });
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ThreadMatch {
    boardKey: string;       // e.g. "4chan:mu", "easychan:kr"
    threadId: number;
    subject?: string;
    comment?: string;
    lastModified?: number;
    replies?: number;
}

export interface MediaItem {
    id: number;
    boardKey: string;       // e.g. "easychan:kr"
    source: BoardSource;
    boardId: string;        // e.g. "kr"
    threadId: number;
    url: string;
    thumbnail: string;
    filename: string;
    ext: string;
    tim: number;            // timestamp used for sorting
    size: number;           // file size in bytes
}

// ─── Meguca file_type mapping ────────────────────────────────────────────────
// The file_type field determines the actual container/file extension on disk.
// The codec field only tells us the encoding inside the container.
const MEGUCA_FILE_TYPE_EXT: Record<number, string> = {
    0: '.jpg',   // JPEG
    1: '.png',   // PNG
    2: '.gif',   // GIF
    3: '.webm',  // WebM
    4: '.mp4',   // MP4
    5: '.ogg',   // OGG
    14: '.webp', // WebP
};

// ─── Catalog Fetch ───────────────────────────────────────────────────────────

async function fetchCatalog(boardKey: string): Promise<any> {
    const cacheKey = `catalog:${boardKey}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const response = await fetch(`/api/catalog?key=${encodeURIComponent(boardKey)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setCache(cacheKey, data);
        return data;
    } catch (error) {
        console.error(`[API] Error fetching catalog for ${boardKey}:`, error);
        return null;
    }
}

// ─── Search Threads ──────────────────────────────────────────────────────────

/**
 * Search for threads across multiple boards.
 *
 * - 4chan: Returns ALL threads matching any keyword (ephemeral threads)
 * - Meguca: Returns the most recent N threads (persistent threads, no keyword filter on catalog)
 */
export async function searchThreads(
    boardKeys: string[],
    keywords: string[],
    megucaThreadCount: number = 2,
    archived: boolean = false,
): Promise<ThreadMatch[]> {
    const allMatches: ThreadMatch[] = [];

    // Process boards sequentially to avoid hammering FlareSolverr with parallel requests
    for (const boardKey of boardKeys) {
        const config = getBoardByKey(boardKey);
        if (!config) {
            console.warn(`[Search] Unknown board key: ${boardKey}`);
            continue;
        }

        // Desuarchive uses its own search API, not catalog
        // Filter out threads still active on 4chan
        if (config.source === 'desuarchive') {
            // Fetch more than needed since some will be filtered out
            const desuMatches = await searchDesuarchive(boardKey, keywords, megucaThreadCount + 10);

            // Get active 4chan thread IDs for this board
            const fourchanKey = `4ch:${config.id}`;
            const catalog = await fetchCatalog(fourchanKey);
            const activeIds = new Set<number>();
            if (catalog && Array.isArray(catalog)) {
                for (const page of catalog) {
                    if (!page.threads) continue;
                    for (const thread of page.threads) {
                        activeIds.add(thread.no);
                    }
                }
            }

            const filtered = desuMatches
                .filter(m => !activeIds.has(m.threadId))
                .slice(0, megucaThreadCount);

            allMatches.push(...filtered);
            console.log(`[Search] Desuarchive /${config.id}/: ${desuMatches.length} found, ${activeIds.size} active on 4chan, ${filtered.length} archived returned`);
            continue;
        }

        const catalog = await fetchCatalog(boardKey);
        if (!catalog) {
            console.log(`[Search] No catalog data for ${boardKey}`);
            continue;
        }

        if (config.isMeguca) {
            // Meguca catalog: { threads: [...] } or array directly
            let threads: any[] = catalog.threads || [];
            if (!Array.isArray(threads) && Array.isArray(catalog)) {
                threads = catalog;
            }

            // Sort by ID descending (most recent first)
            threads.sort((a: any, b: any) => (b.id ?? 0) - (a.id ?? 0));

            // When archived, skip the most recent thread (equivalent to archive-only)
            const pool = archived ? threads.slice(1) : threads;

            // Take the N most recent threads
            const selected = pool.slice(0, megucaThreadCount);

            for (const t of selected) {
                allMatches.push({
                    boardKey,
                    threadId: t.id,
                    subject: t.subject,
                    comment: t.body,
                    lastModified: t.update_time,
                    replies: t.post_count,
                });
            }

            console.log(`[Search] ${config.siteLabel} /${config.id}/: ${threads.length} total threads${archived ? ' (archived, skipped newest)' : ''}, using ${selected.length}`);

        } else {
            // 4chan catalog: array of pages, each with threads array
            let matchCount = 0;
            for (const page of catalog) {
                if (!page.threads) continue;
                for (const thread of page.threads) {
                    const subject = (thread.sub || '').toLowerCase();
                    const comment = (thread.com || '').toLowerCase();

                    const hasMatch = keywords.some(k => {
                        const lower = k.toLowerCase();
                        return subject.includes(lower) || comment.includes(lower);
                    });

                    if (hasMatch) {
                        allMatches.push({
                            boardKey,
                            threadId: thread.no,
                            subject: thread.sub,
                            comment: thread.com,
                            lastModified: thread.last_modified,
                            replies: thread.replies,
                        });
                        matchCount++;
                    }
                }
            }

            console.log(`[Search] 4chan /${config.id}/: ${matchCount} matching threads`);
        }
    }

    return allMatches;
}

// ─── Desuarchive Search ──────────────────────────────────────────────────────

/**
 * Search desuarchive for archived threads matching keywords.
 * Returns the most recent N threads.
 */
export async function searchDesuarchive(
    boardKey: string,
    keywords: string[],
    threadCount: number = 5,
): Promise<ThreadMatch[]> {
    const config = getBoardByKey(boardKey);
    if (!config || config.source !== 'desuarchive') return [];

    const query = keywords.join(' ');
    const field = config.searchField === 'comment' ? 'comment' : 'subject';

    try {
        const response = await fetch(
            `/api/desuarchive?board=${config.id}&q=${encodeURIComponent(query)}&field=${field}&limit=${threadCount}`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const threads = await response.json();

        return threads.map((t: any) => ({
            boardKey,
            threadId: t.no,
            subject: t.sub,
            comment: t.com,
        }));
    } catch (error) {
        console.error(`[API] Error searching desuarchive ${boardKey}:`, error);
        return [];
    }
}

// ─── Thread Media Extraction ─────────────────────────────────────────────────

/**
 * Fetch a single thread and extract all media items from it.
 */
export async function getThreadMedia(boardKey: string, threadId: number): Promise<MediaItem[]> {
    const cacheKey = `thread:${boardKey}:${threadId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const config = getBoardByKey(boardKey);
    if (!config) {
        console.error(`[API] Unknown board key: ${boardKey}`);
        return [];
    }

    try {
        let data: any;

        if (config.source === 'desuarchive') {
            // Use desuarchive-specific thread API
            const response = await fetch(`/api/desuthread?board=${config.id}&id=${threadId}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            data = await response.json();
            const media = extractDesuarchiveMedia(data, boardKey, config.id, threadId);
            setCache(cacheKey, media);
    return media;
}

/**
 * Extract media from a desuarchive (foolfuuka) thread JSON.
 */
function extractDesuarchiveMedia(
    data: any,
    boardKey: string,
    boardId: string,
    threadId: number,
): MediaItem[] {
    const media: MediaItem[] = [];

    // Foolfuuka format: { OP post num: { op: {...}, posts: { postNum: {...}, ... } } }
    const threadData = data[String(threadId)] || data[Object.keys(data)[0]];
    if (!threadData) return media;

    const allPosts: any[] = [];

    // Add OP
    if (threadData.op) {
        allPosts.push(threadData.op);
    }

    // Add replies
    if (threadData.posts) {
        for (const postKey of Object.keys(threadData.posts)) {
            allPosts.push(threadData.posts[postKey]);
        }
    }

    for (const post of allPosts) {
        if (!post.media) continue;

        const m = post.media;
        // media_link is the full-size image URL
        // thumb_link is the thumbnail URL
        const url = m.media_link || m.remote_media_link;
        const thumbnail = m.thumb_link;

        if (!url) continue;

        // Extract extension from URL or media_filename
        const filename = m.media_filename || 'unknown';
        const extMatch = filename.match(/\.\w+$/);
        const ext = extMatch ? extMatch[0] : '.jpg';

        media.push({
            id: parseInt(post.num, 10) || 0,
            boardKey,
            source: 'desuarchive',
            boardId,
            threadId,
            url,
            thumbnail: thumbnail || url,
            filename: filename.replace(/\.\w+$/, ''),
            ext,
            tim: (parseInt(post.timestamp, 10) || 0) * 1000,
            size: parseInt(m.media_size, 10) || 0,
        });
    }

    return media;
}

        const response = await fetch(`/api/thread?key=${encodeURIComponent(boardKey)}&id=${threadId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        data = await response.json();

        let media: MediaItem[];

        if (config.isMeguca) {
            media = extractMegucaMedia(data, boardKey, config.source, config.id, threadId, config.baseUrl);
        } else {
            media = extractFourchanMedia(data, boardKey, config.id, threadId);
        }

        setCache(cacheKey, media);
        return media;
    } catch (error) {
        console.error(`[API] Error fetching thread ${boardKey}/${threadId}:`, error);
        return [];
    }
}

/**
 * Extract media from a meguca-format thread JSON.
 * Works for both easychan and mokachan (same meguca software).
 *
 * Uses file_type (not codec) to determine the file extension.
 * file_type tells us the actual container format on disk:
 *   0=JPEG, 1=PNG, 2=GIF, 3=WEBM, 4=MP4, 5=OGG, 14=WEBP
 * codec tells us the encoding (vp8, vp9, h264, etc.) but NOT the container.
 */
function extractMegucaMedia(
    data: any,
    boardKey: string,
    source: BoardSource,
    boardId: string,
    threadId: number,
    baseUrl: string,
): MediaItem[] {
    const media: MediaItem[] = [];

    // Root object is OP, 'posts' array has replies
    const opPost = { ...data, posts: undefined };
    const replies = data.posts || [];
    const allPosts = [opPost, ...replies];

    for (const post of allPosts) {
        if (!post.image) continue;

        const img = post.image;
        if (!img.sha1) continue;

        const hash = img.sha1;
        const fileType: number = img.file_type ?? -1;

        // Use file_type to determine extension (authoritative)
        let ext = MEGUCA_FILE_TYPE_EXT[fileType];
        if (!ext) {
            // Fallback to codec if file_type is unknown
            switch (img.codec) {
                case 'jpeg': case 'jpg': ext = '.jpg'; break;
                case 'png':  ext = '.png'; break;
                case 'gif':  ext = '.gif'; break;
                case 'h264': case 'hevc': case 'av1': ext = '.mp4'; break;
                case 'vp8':  case 'vp9':  ext = '.webm'; break;
                case 'webp': ext = '.webp'; break;
                default:     ext = `.${img.codec || 'bin'}`;
            }
        }

        // Thumbnail extension: thumb_type 0 = jpg, else webp
        const thumbExt = img.thumb_type === 0 ? '.jpg' : '.webp';

        media.push({
            id: post.id,
            boardKey,
            source,
            boardId,
            threadId,
            url: `${baseUrl}/assets/images/src/${hash}${ext}`,
            thumbnail: `${baseUrl}/assets/images/thumb/${hash}${thumbExt}`,
            filename: img.name || 'unknown',
            ext,
            tim: (post.time || 0) * 1000,
            size: img.size || 0,
        });
    }

    return media;
}

/**
 * Extract media from a 4chan-format thread JSON.
 */
function extractFourchanMedia(
    data: any,
    boardKey: string,
    boardId: string,
    threadId: number,
): MediaItem[] {
    const media: MediaItem[] = [];
    const posts = data.posts || [];

    for (const post of posts) {
        if (!post.tim || !post.ext) continue;

        media.push({
            id: post.no,
            boardKey,
            source: '4chan',
            boardId,
            threadId,
            url: `https://i.4cdn.org/${boardId}/${post.tim}${post.ext}`,
            thumbnail: `https://i.4cdn.org/${boardId}/${post.tim}s.jpg`,
            filename: post.filename || 'unknown',
            ext: post.ext,
            tim: (post.time || 0) * 1000,
            size: post.fsize || 0,
        });
    }

    return media;
}
