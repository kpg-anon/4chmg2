import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getBoardByKey } from '@/lib/boards';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');

    if (!key) {
        return new NextResponse('Missing key parameter', { status: 400 });
    }

    const config = getBoardByKey(key);
    if (!config) {
        return new NextResponse(`Unknown board key: ${key}`, { status: 400 });
    }

    try {
        if (config.isMeguca) {
            const catalogUrl = `${config.baseUrl}/json/boards/${config.id}/catalog`;

            if (config.needsCloudflareBypass) {
                const { fetchWithFlareSolverr } = await import('@/lib/server/cloudflareBypass');
                const data = await fetchWithFlareSolverr(catalogUrl);
                return NextResponse.json(data);
            } else {
                const { fetchMegucaJson } = await import('@/lib/server/cloudflareBypass');
                const data = await fetchMegucaJson(catalogUrl);
                return NextResponse.json(data);
            }
        }

        // 2ch.org (Dvach)
        if (config.source === 'dvach') {
            const response = await axios.get(`${config.baseUrl}/${config.id}/catalog.json`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                },
                timeout: 15000,
            });
            return NextResponse.json(response.data);
        }

        // 4chan
        const response = await axios.get(`${config.baseUrl}/${config.id}/catalog.json`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            },
            timeout: 15000,
        });
        return NextResponse.json(response.data);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Error fetching catalog for ${key}:`, msg);
        return new NextResponse(`Error fetching catalog for ${key}`, { status: 500 });
    }
}
