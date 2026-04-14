import { NextRequest, NextResponse } from 'next/server';
import { fetchImage } from '@/lib/server/cloudflareBypass';
import { getCachedMedia, cacheMedia } from '@/lib/server/mediaCache';

const CONTENT_TYPES: Record<string, string> = {
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.gif': 'image/gif',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
};

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

function getContentType(url: string): string {
    const lower = url.toLowerCase();
    for (const [ext, type] of Object.entries(CONTENT_TYPES)) {
        if (lower.includes(ext)) return type;
    }
    return 'application/octet-stream';
}

function parseRange(rangeHeader: string, totalSize: number): { start: number; end: number } | null {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) return null;
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
    if (start >= totalSize || end >= totalSize || start > end) return null;
    return { start, end };
}

const CACHE_HEADERS = {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': 'bytes',
};

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const urlParam = searchParams.get('url');

    if (!urlParam) {
        return new NextResponse('Missing URL parameter', { status: 400 });
    }

    let url: string;
    try {
        url = decodeURIComponent(urlParam);
    } catch {
        return new NextResponse('Invalid URL encoding', { status: 400 });
    }

    if (!isAllowedUrl(url)) {
        return new NextResponse('URL not allowed', { status: 403 });
    }

    const contentType = getContentType(url);
    const rangeHeader = request.headers.get('Range');

    // ── Try disk cache first ──
    if (rangeHeader) {
        // Range request — try to serve from cached file via streaming
        const cached = await getCachedMedia(url);
        if (cached) {
            const range = parseRange(rangeHeader, cached.size);
            if (range) {
                const slice = cached.buffer.subarray(range.start, range.end + 1);
                return new NextResponse(new Uint8Array(slice), {
                    status: 206,
                    headers: {
                        ...CACHE_HEADERS,
                        'Content-Type': contentType,
                        'Content-Length': String(slice.length),
                        'Content-Range': `bytes ${range.start}-${range.end}/${cached.size}`,
                    },
                });
            }
        }
    } else {
        // Full request — serve from cache if available
        const cached = await getCachedMedia(url);
        if (cached) {
            return new NextResponse(new Uint8Array(cached.buffer), {
                status: 200,
                headers: {
                    ...CACHE_HEADERS,
                    'Content-Type': contentType,
                    'Content-Length': String(cached.size),
                },
            });
        }
    }

    // ── Cache miss — fetch from origin ──
    try {
        const imageBuffer = await fetchImage(url);

        // Save to disk cache (fire-and-forget)
        cacheMedia(url, imageBuffer).catch(() => {});

        // Handle range request on freshly fetched buffer
        if (rangeHeader) {
            const range = parseRange(rangeHeader, imageBuffer.length);
            if (range) {
                const slice = imageBuffer.subarray(range.start, range.end + 1);
                return new NextResponse(new Uint8Array(slice), {
                    status: 206,
                    headers: {
                        ...CACHE_HEADERS,
                        'Content-Type': contentType,
                        'Content-Length': String(slice.length),
                        'Content-Range': `bytes ${range.start}-${range.end}/${imageBuffer.length}`,
                    },
                });
            }
        }

        return new NextResponse(new Uint8Array(imageBuffer), {
            status: 200,
            headers: {
                ...CACHE_HEADERS,
                'Content-Type': contentType,
                'Content-Length': String(imageBuffer.length),
            },
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Error proxying image:', msg);
        return new NextResponse('Error fetching image', { status: 500 });
    }
}
