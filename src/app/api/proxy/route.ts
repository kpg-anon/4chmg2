import { NextRequest, NextResponse } from 'next/server';
import { fetchImage, keepTunnelAlive } from '@/lib/server/cloudflareBypass';

const CONTENT_TYPES: Record<string, string> = {
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.gif': 'image/gif',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
};

// Only proxy media from known board domains.
// Add a hostname here when a new board source is added to src/lib/boards.ts.
const ALLOWED_HOSTNAMES = new Set([
    'i.4cdn.org',
    'is2.4chan.org',
    'easychan.net',
    'mokachan.cafe',
    'desuarchive.org',
]);

function isAllowedUrl(url: string): boolean {
    try {
        const { hostname } = new URL(url);
        // Allow exact match or subdomain (e.g. assets.easychan.net)
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

    try {
        await keepTunnelAlive();

        const imageBuffer = await fetchImage(url);
        const contentType = getContentType(url);

        return new NextResponse(imageBuffer as Buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Error proxying image:', msg);
        return new NextResponse('Error fetching image', { status: 500 });
    }
}
