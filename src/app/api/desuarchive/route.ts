import { NextRequest, NextResponse } from 'next/server';
import { desuGet } from '@/lib/server/desuLimiter';

/**
 * Search desuarchive (foolfuuka) for threads matching a query.
 * GET /api/desuarchive?board=mu&q=kpop&field=subject&limit=5
 *
 * Returns an array of `{ no, sub, com }` thread stubs, newest first, plus an
 * `X-Desu-Exhausted` header telling the caller whether the archive ran out of
 * results before `limit` was reached (so the UI knows when to stop offering
 * another page).
 */

// Foolfuuka serves a fixed 25 results per page, so anything past the first 25
// threads has to be paged for. The cap bounds a pathological request: /trash/
// "kpop" alone reports ~9000 matching OPs, and walking all of them would be
// thousands of upstream calls.
const PAGE_SIZE = 25;
const MAX_PAGES = 40;

interface FoolfuukaPost {
    thread_num?: string | number;
    title?: string | null;
    comment_sanitized?: string | null;
    comment?: string | null;
}

interface FoolfuukaSearchResponse {
    // Result pages are keyed by index ("0"), alongside a "meta" entry.
    [key: string]: { posts?: FoolfuukaPost[] | Record<string, FoolfuukaPost> } | unknown;
}

function extractPosts(data: FoolfuukaSearchResponse): FoolfuukaPost[] {
    const out: FoolfuukaPost[] = [];
    for (const key of Object.keys(data)) {
        if (key === 'meta') continue;
        const page = data[key] as { posts?: FoolfuukaPost[] | Record<string, FoolfuukaPost> } | null;
        if (!page || typeof page !== 'object' || !page.posts) continue;
        // Newer foolfuuka returns posts as an array, older builds as an object.
        out.push(...(Array.isArray(page.posts) ? page.posts : Object.values(page.posts)));
    }
    return out;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const board = searchParams.get('board');
    const query = searchParams.get('q');
    const field = searchParams.get('field') || 'subject'; // 'subject' or 'comment'
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '5', 10) || 5);

    if (!board || !query) {
        return new NextResponse('Missing board or q parameter', { status: 400 });
    }

    try {
        // Desuarchive search API (foolfuuka)
        // For subject search: /search/subject/kpop/board/mu/type/op/
        // For comment/text search: /search/text/kpop/board/mu/type/op/
        const searchType = field === 'subject' ? 'subject' : 'text';
        const baseUrl = `https://desuarchive.org/_/api/chan/search/?boards=${board}&${searchType}=${encodeURIComponent(query)}&type=op`;

        const threads: { no: number; sub?: string; com?: string }[] = [];
        const seen = new Set<number>();
        let exhausted = false;
        let pagesRead = 0;

        // Pages come back newest-first and don't overlap, so collecting until the
        // caller's limit is met preserves that ordering without a global sort.
        for (let page = 1; page <= MAX_PAGES && threads.length < limit; page++) {
            const pageUrl = `${baseUrl}&page=${page}`;
            const data = await desuGet<FoolfuukaSearchResponse>(pageUrl);
            pagesRead++;

            const posts = extractPosts(data);
            if (posts.length === 0) {
                exhausted = true;
                break;
            }

            for (const post of posts) {
                if (!post.thread_num) continue;
                const no = parseInt(String(post.thread_num), 10);
                if (!Number.isFinite(no) || seen.has(no)) continue;
                seen.add(no);
                threads.push({
                    no,
                    sub: post.title || undefined,
                    com: post.comment_sanitized || post.comment || undefined,
                });
            }

            // A short page is the last page.
            if (posts.length < PAGE_SIZE) {
                exhausted = true;
                break;
            }
        }

        const limited = threads.slice(0, limit);

        console.log(`[Desuarchive] /${board}/ "${query}": ${pagesRead} page(s), ${threads.length} unique threads, returning ${limited.length}${exhausted ? ' (archive exhausted)' : ''}`);

        return NextResponse.json(limited, {
            headers: {
                // Only meaningful when we returned fewer than asked for.
                'X-Desu-Exhausted': exhausted && threads.length <= limit ? '1' : '0',
            },
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Desuarchive] Error searching ${board}:`, msg);
        return new NextResponse(`Error searching desuarchive for ${board}`, { status: 500 });
    }
}
