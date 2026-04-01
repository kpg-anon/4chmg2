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

    try {
        const url = decodeURIComponent(urlParam);
        await keepTunnelAlive();

        const imageBuffer = await fetchImage(url);
        const contentType = getContentType(url);

        return new NextResponse(imageBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error: any) {
        console.error('Error proxying image:', error.message || error);
        return new NextResponse('Error fetching image', { status: 500 });
    }
}
