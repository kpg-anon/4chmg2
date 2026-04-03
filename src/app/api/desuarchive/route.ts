import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

/**
 * Search desuarchive (foolfuuka) for threads matching a query.
 * GET /api/desuarchive?board=mu&q=kpop&field=subject&limit=5
 *
 * Returns an array of thread objects with their posts/media.
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const board = searchParams.get('board');
    const query = searchParams.get('q');
    const field = searchParams.get('field') || 'subject'; // 'subject' or 'comment'
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    if (!board || !query) {
        return new NextResponse('Missing board or q parameter', { status: 400 });
    }

    try {
        // Desuarchive search API (foolfuuka)
        // For subject search: /search/subject/kpop/board/mu/type/op/
        // For comment/text search: /search/text/kpop/board/mu/type/op/
        const searchType = field === 'subject' ? 'subject' : 'text';
        const searchUrl = `https://desuarchive.org/_/api/chan/search/?boards=${board}&${searchType}=${encodeURIComponent(query)}&type=op`;

        console.log(`[Desuarchive] Searching: ${searchUrl}`);

        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            },
            timeout: 30000,
        });

        // Foolfuuka returns { 0: { posts: { threadNum: post, ... } }, ... }
        // We need to extract thread numbers from the OP posts
        const data = response.data;
        const threads: { no: number; sub?: string; com?: string }[] = [];

        // The search results are keyed by page number
        if (data && typeof data === 'object') {
            const posts = data;
            // Iterate through all result entries
            for (const pageKey of Object.keys(posts)) {
                const page = posts[pageKey];
                if (page && page.posts) {
                    for (const postKey of Object.keys(page.posts)) {
                        const post = page.posts[postKey];
                        if (post && post.thread_num) {
                            threads.push({
                                no: parseInt(post.thread_num, 10),
                                sub: post.title || undefined,
                                com: post.comment_sanitized || post.comment || undefined,
                            });
                        }
                    }
                }
            }
        }

        // Deduplicate by thread number, take most recent N
        const seen = new Set<number>();
        const unique = threads.filter(t => {
            if (seen.has(t.no)) return false;
            seen.add(t.no);
            return true;
        });

        // Sort by thread number descending (most recent first)
        unique.sort((a, b) => b.no - a.no);

        // Take the requested limit
        const limited = unique.slice(0, limit);

        console.log(`[Desuarchive] Found ${unique.length} unique threads for /${board}/, returning ${limited.length}`);

        return NextResponse.json(limited);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Desuarchive] Error searching ${board}:`, msg);
        return new NextResponse(`Error searching desuarchive for ${board}`, { status: 500 });
    }
}
