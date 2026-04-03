'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function MediaPageContent() {
    const searchParams = useSearchParams();
    const board = searchParams.get('board') || '';
    const thread = searchParams.get('thread') || '';
    const post = searchParams.get('post') || '';

    return (
        <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] p-8 flex items-center justify-center">
            <div className="text-center">
                <p className="text-[var(--text-muted)]">
                    Direct media view — Board: {board}, Thread: {thread}, Post: {post}
                </p>
                <Link href="/" className="text-[var(--accent)] hover:underline mt-4 inline-block">
                    Go to search
                </Link>
            </div>
        </main>
    );
}

export default function MediaPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center text-[var(--text-muted)]">Loading...</div>}>
            <MediaPageContent />
        </Suspense>
    );
}
