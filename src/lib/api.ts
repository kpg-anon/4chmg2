import { getBoardByKey, type BoardSource } from '@/lib/boards';

// Cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30_000; // 30 seconds

function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
        return entry.data as T;
    }
    cache.delete(key);
    return null;
}

function setCache(key: string, data: unknown): void {
    cache.set(key, { data, timestamp: Date.now() });
}

// Types
export interface ThreadMatch {
    boardKey: string;
    threadId: number;
    subject?: string;
    comment?: string;
    lastModified?: number;
    replies?: number;
}

export interface MediaItem {
    id: number;
    boardKey: string;
    source: BoardSource;
    boardId: string;
    threadId: number;
    url: string;
    thumbnail: string;
    filename: string;
    ext: string;
    tim: number;
    size: number;
}

interface FourchanCatalogThread {
    no: number;
    sub?: string;
    com?: string;
    last_modified?: number;
    replies?: number;
}

interface FourchanCatalogPage {
    threads?: FourchanCatalogThread[];
}

interface FourchanPost {
    no: number;
    tim?: number;
    ext?: string;
    filename?: string;
    time?: number;
    fsize?: number;
}

interface FourchanThreadResponse {
    posts?: FourchanPost[];
}

interface DesuarchiveSearchResult {
    no: number;
    sub?: string;
    com?: string;
}

interface DesuarchiveMediaPayload {
    media_link?: string;
    remote_media_link?: string;
    thumb_link?: string;
    media_filename?: string;
    media_size?: string | number;
}

interface DesuarchivePost {
    num?: string | number;
    timestamp?: string | number;
    media?: DesuarchiveMediaPayload;
}

interface DesuarchiveThreadRecord {
    op?: DesuarchivePost;
    posts?: Record<string, DesuarchivePost>;
}

type DesuarchiveThreadResponse = Record<string, DesuarchiveThreadRecord>;

interface MegucaCatalogThread {
    id: number;
    subject?: string;
    body?: string;
    update_time?: number;
    post_count?: number;
}

interface MegucaCatalogResponse {
    threads?: MegucaCatalogThread[];
}

interface MegucaImage {
    sha1?: string;
    file_type?: number;
    codec?: string;
    thumb_type?: number;
    name?: string;
    size?: number;
}

interface MegucaPost {
    id: number;
    time?: number;
    image?: MegucaImage;
}

interface MegucaThreadResponse extends MegucaPost {
    posts?: MegucaPost[];
}

// Meguca file_type mapping
const MEGUCA_FILE_TYPE_EXT: Record<number, string> = {
    0: '.jpg',
    1: '.png',
    2: '.gif',
    3: '.webm',
    4: '.mp4',
    5: '.ogg',
    14: '.webp',
};

function toNumber(value: string | number | undefined): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseInt(value, 10) || 0;
    return 0;
}

// Catalog Fetch
async function fetchCatalog(boardKey: string): Promise<unknown | null> {
    const cacheKey = `catalog:${boardKey}`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) return cached;

    try {
        const response = await fetch(`/api/catalog?key=${encodeURIComponent(boardKey)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        setCache(cacheKey, data);
        return data;
    } catch (error) {
        console.error(`[API] Error fetching catalog for ${boardKey}:`, error);
        return null;
    }
}

// Search Threads
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
            const desuMatches = await searchDesuarchive(boardKey, keywords, megucaThreadCount + 10);

            const fourchanKey = `4ch:${config.id}`;
            const catalog = await fetchCatalog(fourchanKey);
            const activeIds = new Set<number>();
            const pages = Array.isArray(catalog) ? (catalog as FourchanCatalogPage[]) : [];

            for (const page of pages) {
                if (!page.threads) continue;
                for (const thread of page.threads) {
                    activeIds.add(thread.no);
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
            let threads: MegucaCatalogThread[] = [];
            if (Array.isArray(catalog)) {
                threads = catalog as MegucaCatalogThread[];
            } else if (catalog && typeof catalog === 'object') {
                const response = catalog as MegucaCatalogResponse;
                if (Array.isArray(response.threads)) {
                    threads = response.threads;
                }
            }

            threads.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
            const pool = archived ? threads.slice(1) : threads;
            const selected = pool.slice(0, megucaThreadCount);

            for (const thread of selected) {
                allMatches.push({
                    boardKey,
                    threadId: thread.id,
                    subject: thread.subject,
                    comment: thread.body,
                    lastModified: thread.update_time,
                    replies: thread.post_count,
                });
            }

            console.log(`[Search] ${config.siteLabel} /${config.id}/: ${threads.length} total threads${archived ? ' (archived, skipped newest)' : ''}, using ${selected.length}`);
        } else {
            const pages = Array.isArray(catalog) ? (catalog as FourchanCatalogPage[]) : [];
            let matchCount = 0;

            for (const page of pages) {
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

// Desuarchive Search
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

        const threads: unknown = await response.json();
        if (!Array.isArray(threads)) return [];

        return (threads as DesuarchiveSearchResult[]).map(thread => ({
            boardKey,
            threadId: thread.no,
            subject: thread.sub,
            comment: thread.com,
        }));
    } catch (error) {
        console.error(`[API] Error searching desuarchive ${boardKey}:`, error);
        return [];
    }
}

// Thread Media Extraction
export async function getThreadMedia(boardKey: string, threadId: number): Promise<MediaItem[]> {
    const cacheKey = `thread:${boardKey}:${threadId}`;
    const cached = getCached<MediaItem[]>(cacheKey);
    if (cached) return cached;

    const config = getBoardByKey(boardKey);
    if (!config) {
        console.error(`[API] Unknown board key: ${boardKey}`);
        return [];
    }

    try {
        let data: unknown;

        if (config.source === 'desuarchive') {
            const response = await fetch(`/api/desuthread?board=${config.id}&id=${threadId}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            data = await response.json();

            const media = extractDesuarchiveMedia(data, boardKey, config.id, threadId);
            setCache(cacheKey, media);
            return media;
        }

        const response = await fetch(`/api/thread?key=${encodeURIComponent(boardKey)}&id=${threadId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        data = await response.json();

        const media = config.isMeguca
            ? extractMegucaMedia(data, boardKey, config.source, config.id, threadId, config.baseUrl)
            : extractFourchanMedia(data, boardKey, config.id, threadId);

        setCache(cacheKey, media);
        return media;
    } catch (error) {
        console.error(`[API] Error fetching thread ${boardKey}/${threadId}:`, error);
        return [];
    }
}

function extractDesuarchiveMedia(
    data: unknown,
    boardKey: string,
    boardId: string,
    threadId: number,
): MediaItem[] {
    const media: MediaItem[] = [];
    if (!data || typeof data !== 'object') return media;

    const threadMap = data as DesuarchiveThreadResponse;
    const fallbackKey = Object.keys(threadMap)[0];
    const threadData = threadMap[String(threadId)] || (fallbackKey ? threadMap[fallbackKey] : undefined);
    if (!threadData) return media;

    const allPosts: DesuarchivePost[] = [];
    if (threadData.op) {
        allPosts.push(threadData.op);
    }
    if (threadData.posts) {
        allPosts.push(...Object.values(threadData.posts));
    }

    for (const post of allPosts) {
        if (!post.media) continue;

        const mediaInfo = post.media;
        const url = mediaInfo.media_link || mediaInfo.remote_media_link;
        const thumbnail = mediaInfo.thumb_link;
        if (!url) continue;

        const filename = mediaInfo.media_filename || 'unknown';
        const extMatch = filename.match(/\.\w+$/);
        const ext = extMatch ? extMatch[0] : '.jpg';

        media.push({
            id: toNumber(post.num),
            boardKey,
            source: 'desuarchive',
            boardId,
            threadId,
            url,
            thumbnail: thumbnail || url,
            filename: filename.replace(/\.\w+$/, ''),
            ext,
            tim: toNumber(post.timestamp) * 1000,
            size: toNumber(mediaInfo.media_size),
        });
    }

    return media;
}

function extractMegucaMedia(
    data: unknown,
    boardKey: string,
    source: BoardSource,
    boardId: string,
    threadId: number,
    baseUrl: string,
): MediaItem[] {
    const media: MediaItem[] = [];
    if (!data || typeof data !== 'object') return media;

    const thread = data as MegucaThreadResponse;
    const opPost: MegucaPost = {
        id: thread.id,
        time: thread.time,
        image: thread.image,
    };
    const replies = Array.isArray(thread.posts) ? thread.posts : [];
    const allPosts: MegucaPost[] = [opPost, ...replies];

    for (const post of allPosts) {
        if (!post.image || !post.image.sha1) continue;

        const image = post.image;
        const hash = image.sha1;
        const fileType = image.file_type ?? -1;

        let ext = MEGUCA_FILE_TYPE_EXT[fileType];
        if (!ext) {
            switch (image.codec) {
                case 'jpeg':
                case 'jpg':
                    ext = '.jpg';
                    break;
                case 'png':
                    ext = '.png';
                    break;
                case 'gif':
                    ext = '.gif';
                    break;
                case 'h264':
                case 'hevc':
                case 'av1':
                    ext = '.mp4';
                    break;
                case 'vp8':
                case 'vp9':
                    ext = '.webm';
                    break;
                case 'webp':
                    ext = '.webp';
                    break;
                default:
                    ext = `.${image.codec || 'bin'}`;
                    break;
            }
        }

        const thumbExt = image.thumb_type === 0 ? '.jpg' : '.webp';

        media.push({
            id: post.id,
            boardKey,
            source,
            boardId,
            threadId,
            url: `${baseUrl}/assets/images/src/${hash}${ext}`,
            thumbnail: `${baseUrl}/assets/images/thumb/${hash}${thumbExt}`,
            filename: image.name || 'unknown',
            ext,
            tim: (post.time || 0) * 1000,
            size: image.size || 0,
        });
    }

    return media;
}

function extractFourchanMedia(
    data: unknown,
    boardKey: string,
    boardId: string,
    threadId: number,
): MediaItem[] {
    const media: MediaItem[] = [];
    if (!data || typeof data !== 'object') return media;

    const response = data as FourchanThreadResponse;
    const posts = Array.isArray(response.posts) ? response.posts : [];

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
