'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Check, ChevronUp, RefreshCw, Funnel, SlidersHorizontal, X } from 'lucide-react';
import { parseBoardKeys } from '@/lib/boards';
import { searchThreads, getThreadMedia, type MediaItem, type ThreadMatch } from '@/lib/api';
import SearchForm from '@/components/SearchForm';
import Gallery from '@/components/Gallery';

function SearchPageContent() {
    const searchParams = useSearchParams();
    const boardParam = searchParams.get('boards') || '4ch:mu,4ch:trash';
    const queryParam = searchParams.get('q') || '';
    const threadsParam = searchParams.get('threads') || '1';
    const archivedParam = searchParams.get('archived') === '1';

    const searchKey = `${boardParam}|${queryParam}|${threadsParam}|${archivedParam}`;

    const [media, setMedia] = useState<MediaItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [status, setStatus] = useState('');
    const [threadCount, setThreadCount] = useState(0);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [headerVisible, setHeaderVisible] = useState(true);
    const [mediaFilter, setMediaFilter] = useState<'mixed' | 'images' | 'videos'>('mixed');
    const [filterOpen, setFilterOpen] = useState(false);
    const [filenameFilter, setFilenameFilter] = useState('');
    const [filenameRegex, setFilenameRegex] = useState(false);
    const [filenameFilterOpen, setFilenameFilterOpen] = useState(false);

    const didFetchRef = useRef('');
    const fetchedThreadsRef = useRef<ThreadMatch[]>([]);
    const knownMediaIdsRef = useRef(new Set<string>());
    const [newItemIds, setNewItemIds] = useState<Set<number>>(new Set());
    const lastScrollYRef = useRef(0);
    const filenameFilterRef = useRef<HTMLDivElement>(null);
    const filenameInputRef = useRef<HTMLInputElement>(null);

    const boardKeys = parseBoardKeys(boardParam);
    const keywords = queryParam.split('|').filter(Boolean);
    const megucaThreadCount = parseInt(threadsParam, 10) || 1;

    // ── Initial search ──
    useEffect(() => {
        if (didFetchRef.current === searchKey) return;
        didFetchRef.current = searchKey;

        const run = async () => {
            setIsLoading(true);
            setMedia([]);
            setNewItemIds(new Set());
            knownMediaIdsRef.current = new Set<string>();
            setFilenameFilter('');
            setFilenameRegex(false);
            setFilenameFilterOpen(false);
            fetchedThreadsRef.current = [];
            setThreadCount(0);
            setStatus('Searching...');

            try {
                const matches = await searchThreads(boardKeys, keywords, megucaThreadCount, archivedParam);

                if (matches.length === 0) {
                    setStatus('No matching threads found.');
                    setIsLoading(false);
                    return;
                }

                fetchedThreadsRef.current = matches;
                setThreadCount(matches.length);
                setStatus(`Found ${matches.length} threads. Fetching media...`);

                const results = await Promise.all(
                    matches.map(t => getThreadMedia(t.boardKey, t.threadId))
                );

                const allMedia: MediaItem[] = [];
                for (const items of results) allMedia.push(...items);
                allMedia.sort((a, b) => a.tim - b.tim);
                for (const m of allMedia) knownMediaIdsRef.current.add(`${m.boardKey}-${m.id}`);

                setMedia(allMedia);
                setStatus(allMedia.length
                    ? `${matches.length} threads | ${allMedia.length} media items`
                    : 'No media found.'
                );
            } catch (error) {
                console.error('[Search] Error:', error);
                setStatus('Error occurred while fetching data.');
            } finally {
                setIsLoading(false);
            }
        };

        run();
    }, [searchKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Refresh ──
    const handleRefresh = useCallback(async () => {
        if (isRefreshing || fetchedThreadsRef.current.length === 0) return;
        setIsRefreshing(true);
        setStatus('Checking for new posts...');

        try {
            const results = await Promise.all(
                fetchedThreadsRef.current.map(t => getThreadMedia(t.boardKey, t.threadId))
            );

            const allMedia: MediaItem[] = [];
            for (const items of results) allMedia.push(...items);
            const newMedia = allMedia.filter(m => !knownMediaIdsRef.current.has(`${m.boardKey}-${m.id}`));

            if (newMedia.length > 0) {
                newMedia.sort((a, b) => a.tim - b.tim);
                setMedia(prev => {
                    const combined = [...prev, ...newMedia];
                    for (const m of combined) knownMediaIdsRef.current.add(`${m.boardKey}-${m.id}`);
                    return combined;
                });
                setNewItemIds(new Set(newMedia.map(m => m.id)));
                setStatus(`${threadCount} threads | ${knownMediaIdsRef.current.size} media items (+${newMedia.length} new)`);
            } else {
                setStatus(`${threadCount} threads | ${media.length} media items (no new posts)`);
            }
        } catch (error) {
            console.error('[Refresh] Error:', error);
            setStatus('Error checking for new posts.');
        } finally {
            setIsRefreshing(false);
        }
    }, [isRefreshing, threadCount, media.length]);

    // ── Scroll handling: hide header on scroll down, show back-to-top ──
    useEffect(() => {
        const handleScroll = () => {
            const y = window.scrollY;
            setShowScrollTop(y > 400);
            // Hide header when scrolling down past 100px, show when at top
            if (y < 50) {
                setHeaderVisible(true);
            } else if (y > lastScrollYRef.current + 10) {
                setHeaderVisible(false);
            }
            lastScrollYRef.current = y;
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (filenameFilterOpen) {
            requestAnimationFrame(() => filenameInputRef.current?.focus());
        }
    }, [filenameFilterOpen]);

    useEffect(() => {
        if (!filenameFilterOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!filenameFilterRef.current?.contains(event.target as Node)) {
                setFilenameFilterOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [filenameFilterOpen]);

    const VIDEO_EXTS = ['.webm', '.mp4'];
    const typeFiltered = mediaFilter === 'mixed' ? media
        : mediaFilter === 'images' ? media.filter(m => !VIDEO_EXTS.includes(m.ext))
        : media.filter(m => VIDEO_EXTS.includes(m.ext));
    let filteredMedia = typeFiltered;
    let regexValid = true;

    if (filenameFilter) {
        if (filenameRegex) {
            try {
                const re = new RegExp(filenameFilter, 'i');
                filteredMedia = typeFiltered.filter(m => re.test(m.filename));
            } catch {
                regexValid = false;
            }
        } else {
            const needle = filenameFilter.toLowerCase();
            filteredMedia = typeFiltered.filter(m => m.filename.toLowerCase().includes(needle));
        }
    }

    const filterOptions = [
        { value: 'mixed' as const, label: 'Mixed' },
        { value: 'images' as const, label: 'Images' },
        { value: 'videos' as const, label: 'Videos' },
    ];

    const displayStatus = filenameFilter && filteredMedia.length < typeFiltered.length
        ? `${status} (showing ${filteredMedia.length} matching "${filenameFilter}")`
        : status;

    return (
        <div className="min-h-screen bg-[var(--bg-base)]">
            {/* Header — fades out on scroll */}
            <header
                className="sticky top-0 z-40 bg-[var(--bg-base)]/95 backdrop-blur-sm border-b border-[var(--border)] px-4 py-2 transition-all duration-300"
                style={{ opacity: headerVisible ? 1 : 0, pointerEvents: headerVisible ? 'auto' : 'none' }}
            >
                <div className="max-w-7xl mx-auto flex items-center gap-3">
                    {/* Logo + Mascot */}
                    <Link href="/" className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
                        <img src="/mascot.webp" alt="" className="w-8 h-8" draggable={false} />
                        <span className="text-lg font-black tracking-tight bg-gradient-to-r from-[var(--accent)] via-purple-400 to-blue-400 bg-clip-text text-transparent">
                            4CHMG2
                        </span>
                    </Link>

                    {/* Search bar + board picker to the right */}
                    <SearchForm
                        compact
                        showBoardPicker
                        isLoading={isLoading}
                        initialBoardKeys={boardKeys}
                        initialKeywords={queryParam}
                        initialThreadCount={megucaThreadCount}
                        initialArchived={archivedParam}
                    />

                    {/* Filter dropdown */}
                    <div className="relative shrink-0">
                        <button
                            onClick={() => setFilterOpen(f => !f)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all duration-150 cursor-pointer ${mediaFilter !== 'mixed' ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)] text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
                        >
                            <Funnel size={14} />
                            <span>{filterOptions.find(o => o.value === mediaFilter)!.label}</span>
                        </button>
                        {filterOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xl min-w-[120px]">
                                    {filterOptions.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => { setMediaFilter(opt.value); setFilterOpen(false); }}
                                            className={`w-full px-4 py-2 text-sm text-left transition-colors duration-100 cursor-pointer ${mediaFilter === opt.value ? 'text-[var(--accent)] bg-[var(--accent-dim)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div ref={filenameFilterRef} className="relative shrink-0">
                        <button
                            onClick={() => setFilenameFilterOpen(f => !f)}
                            className={`flex h-[34px] w-[38px] items-center justify-center rounded-full text-sm border transition-all duration-150 cursor-pointer ${filenameFilter ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)] text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
                        >
                            <SlidersHorizontal size={14} />
                        </button>
                        {filenameFilterOpen && (
                            <div className="absolute right-0 top-full mt-1.5 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-xl w-72 p-3">
                                <div className="relative">
                                    <input
                                        ref={filenameInputRef}
                                        type="text"
                                        value={filenameFilter}
                                        onChange={e => setFilenameFilter(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Escape') setFilenameFilterOpen(false);
                                        }}
                                        placeholder="Filter by filename..."
                                        className={`w-full bg-[var(--bg-surface)] border rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3 py-2 pr-8 focus:border-[var(--accent)] focus:outline-none transition-colors ${filenameRegex && !regexValid ? 'border-red-500/60' : 'border-[var(--border)]'}`}
                                    />
                                    {filenameFilter && (
                                        <button
                                            onClick={() => {
                                                setFilenameFilter('');
                                                filenameInputRef.current?.focus();
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                <label className="flex items-center gap-2 mt-3 text-sm text-[var(--text-secondary)] cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={filenameRegex}
                                        onChange={e => setFilenameRegex(e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <span className="flex h-4 w-4 items-center justify-center rounded border border-[color:color-mix(in_srgb,var(--border)_70%,white_18%)] bg-[color:color-mix(in_srgb,var(--bg-surface)_82%,white_18%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors peer-checked:border-[var(--accent)] peer-focus-visible:ring-1 peer-focus-visible:ring-[var(--accent)]">
                                        <Check
                                            size={12}
                                            strokeWidth={3}
                                            className={`text-[var(--accent)] transition-opacity ${filenameRegex ? 'opacity-100' : 'opacity-0'}`}
                                        />
                                    </span>
                                    <span>Regex</span>
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Results */}
            <main className="max-w-7xl mx-auto px-4 py-4">
                {status && (
                    <div className="text-center text-[var(--text-muted)] text-sm mb-3">{displayStatus}</div>
                )}

                {isLoading && media.length === 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {Array.from({ length: 20 }).map((_, i) => (
                            <div key={i} className="aspect-square bg-[var(--bg-surface)] rounded-lg animate-pulse" />
                        ))}
                    </div>
                )}

                <Gallery media={filteredMedia} newItemIds={newItemIds} />

                {media.length > 0 && (
                    <div className="text-center pt-3 pb-6">
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="
                                flex items-center gap-2 mx-auto px-5 py-2
                                bg-[var(--bg-surface)] border border-[var(--border)]
                                text-[var(--text-secondary)] rounded-lg text-sm
                                transition-all duration-150 disabled:opacity-40 cursor-pointer
                                hover:border-[var(--accent)] hover:text-[var(--accent)] hover:shadow-[0_0_12px_-3px_var(--accent-glow)]
                                active:scale-95
                            "
                        >
                            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
                            {isRefreshing ? 'Checking...' : 'Check for new posts'}
                        </button>
                    </div>
                )}
            </main>

            {/* Scroll to top — larger rounded square, fade in/out */}
            <button
                onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setHeaderVisible(true); }}
                className="
                    fixed bottom-6 right-6 p-4
                    bg-[var(--accent)] text-white
                    rounded-xl shadow-lg z-30
                    transition-all duration-300 cursor-pointer
                    hover:brightness-110 hover:scale-105
                    active:scale-90
                "
                style={{
                    opacity: showScrollTop ? 1 : 0,
                    pointerEvents: showScrollTop ? 'auto' : 'none',
                    transform: showScrollTop ? 'translateY(0)' : 'translateY(20px)',
                }}
            >
                <ChevronUp size={24} />
            </button>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
            <div className="text-[var(--text-muted)]">Loading...</div>
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={<LoadingState />}>
            <SearchPageContent />
        </Suspense>
    );
}
