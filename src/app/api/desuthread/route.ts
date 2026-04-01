import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

/**
 * Fetch a thread from desuarchive (foolfuuka).
 * GET /api/desuthread?board=mu&id=129476911
 *
 * Returns the thread data in foolfuuka format.
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const board = searchParams.get('board');
    const id = searchParams.get('id');

    if (!board || !id) {
        return new NextResponse('Missing board or id parameter', { status: 400 });
    }

    try {
        const threadUrl = `https://desuarchive.org/_/api/chan/thread/?board=${board}&num=${id}`;

        console.log(`[Desuarchive Thread] Fetching: ${threadUrl}`);

        const response = await axios.get(threadUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            },
            timeout: 30000,
        });

        return NextResponse.json(response.data);
    } catch (error: any) {
        console.error(`[Desuarchive Thread] Error fetching ${board}/${id}:`, error.message || error);
        return new NextResponse(`Error fetching desuarchive thread ${board}/${id}`, { status: 500 });
    }
}
