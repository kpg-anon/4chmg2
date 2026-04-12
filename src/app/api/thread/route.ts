import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getBoardByKey } from '@/lib/boards';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');
    const id = searchParams.get('id');

    if (!key || !id) {
        return new NextResponse('Missing key or id parameter', { status: 400 });
    }

    const config = getBoardByKey(key);
    if (!config) {
        return new NextResponse(`Unknown board key: ${key}`, { status: 400 });
    }

    try {
        if (config.isMeguca) {
            const threadUrl = `${config.baseUrl}/json/boards/${config.id}/${id}`;

            if (config.needsCloudflareBypass) {
                const { fetchWithFlareSolverr } = await import('@/lib/server/cloudflareBypass');
                const data = await fetchWithFlareSolverr(threadUrl);
                return NextResponse.json(data);
            } else {
                const { fetchMegucaJson } = await import('@/lib/server/cloudflareBypass');
                const data = await fetchMegucaJson(threadUrl);
                return NextResponse.json(data);
            }
        }

        // 2ch.org (Dvach)
        if (config.source === 'dvach') {
            const response = await axios.get(`${config.baseUrl}/${config.id}/res/${id}.json`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                },
                timeout: 15000,
            });
            return NextResponse.json(response.data);
        }

        // 4chan
        const response = await axios.get(`${config.baseUrl}/${config.id}/thread/${id}.json`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            },
            timeout: 15000,
        });
        return NextResponse.json(response.data);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Error fetching thread ${key}/${id}:`, msg);
        return new NextResponse(`Error fetching thread ${key}/${id}`, { status: 500 });
    }
}
