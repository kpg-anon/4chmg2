import { NextRequest, NextResponse } from 'next/server';
import { desuGet } from '@/lib/server/desuLimiter';

/**
 * Fetch a thread from desuarchive (foolfuuka).
 * GET /api/desuthread?board=mu&id=129476911
 *
 * Returns the thread data in foolfuuka format. Goes through the shared limiter
 * so a wide archive batch queues instead of tripping the upstream rate limit and
 * losing threads (see desuLimiter).
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

        const data = await desuGet(threadUrl);
        return NextResponse.json(data);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Desuarchive Thread] Error fetching ${board}/${id}:`, msg);
        return new NextResponse(`Error fetching desuarchive thread ${board}/${id}`, { status: 500 });
    }
}
