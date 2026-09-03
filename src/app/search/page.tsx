'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useLayoutEffect, useRef, useCallback, Suspense } from 'react';
import { Check, ChevronUp, ChevronDown, RefreshCw, Funnel, SlidersHorizontal, X, History } from 'lucide-react';
import { parseBoardKeys } from '@/lib/boards';
import { searchThreads, fetchThreadMediaStream, type MediaItem, type ThreadMatch } from '@/lib/api';
import SearchForm from '@/components/SearchForm';
import Gallery, { type GalleryHandle } from '@/components/Gallery';
import TimeScrollbar from '@/components/TimeScrollbar';

/** Tiles carry `data-mkey`, so a specific item can be re-found across renders. */
const tileFor = (mkey: string) =>
    document.querySelector<HTMLElement>(`[data-mkey="${CSS.escape(mkey)}"]`);

/**
 * The topmost tile still on screen, plus where it sits. Threads stream in one at
 * a time and are merged in time order, so a thread that lands late can insert
 * *above* what the reader is looking at; re-finding this tile afterwards is what
 * lets the page put it back where it was instead of shoving the grid down.
 */
function captureScrollAnchor(): { mkey: string; top: number } | null {
    if (window.scrollY <= 0) return null;
    const tiles = document.querySelectorAll<HTMLElement>('[data-mkey]');
    for (const tile of tiles) {
        const rect = tile.getBoundingClientRect();
        if (rect.bottom > 0 && tile.dataset.mkey) {
            return { mkey: tile.dataset.mkey, top: rect.top };
        }
    }
    return null;
}

const summarize = (threads: number, items: number, failed: number) =>
    `${threads} thread${threads === 1 ? '' : 's'} | ${items} media items` +
    (failed > 0 ? ` (${failed} thread${failed === 1 ? '' : 's'} unavailable)` : '');

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
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [status, setStatus] = useState('');
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [autoRefreshMs, setAutoRefreshMs] = useState(300000);
    const [headerVisible, setHeaderVisible] = useState(true);
    const [mediaFilter, setMediaFilter] = useState<'mixed' | 'images' | 'videos'>('mixed');
    const [filterOpen, setFilterOpen] = useState(false);
    const [filenameFilter, setFilenameFilter] = useState('');
    const [filenameRegex, setFilenameRegex] = useState(false);
    const [filenameFilterOpen, setFilenameFilterOpen] = useState(false);

    const didFetchRef = useRef('');
    const fetchedThreadsRef = useRef<ThreadMatch[]>([]);
    const knownMediaIdsRef = useRef(new Set<string>());
    // Media is merged incrementally from a ref rather than from `media` state so
    // successive thread arrivals don't race each other's setState.
    const mediaRef = useRef<MediaItem[]>([]);
    const loadedThreadsRef = useRef(0);
    const failedThreadsRef = useRef(0);
    // Abandoned when the search key changes, so a slow in-flight batch can't
    // write results into the next search.
    const runTokenRef = useRef({ cancelled: false });
    const scrollAnchorRef = useRef<{ mkey: string; top: number } | null>(null);
    // Result of the last "Load more posts", announced as a toast — most often
    // "nothing new", which otherwise leaves the click with no visible effect.
    const [pageToast, setPageToast] = useState<{ text: string; jumpTo: string | null; key: number; exiting: boolean } | null>(null);
    const pageToastTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
    const lastScrollYRef = useRef(0);
    const filenameFilterRef = useRef<HTMLDivElement>(null);
    const filenameInputRef = useRef<HTMLInputElement>(null);
    const galleryRef = useRef<GalleryHandle>(null);
    const newItemIdsRef = useRef(newItemIds);

    const boardKeys = parseBoardKeys(boardParam);
    const keywords = queryParam.split('|').filter(Boolean);
    const megucaThreadCount = parseInt(threadsParam, 10) || 1;

    const showPageToast = useCallback((text: string, jumpTo: string | null) => {
        pageToastTimersRef.current.forEach(clearTimeout);
        const key = Date.now();
        setPageToast({ text, jumpTo, key, exiting: false });
        pageToastTimersRef.current = [
            setTimeout(() => setPageToast(prev => (prev && prev.key === key ? { ...prev, exiting: true } : prev)), 4200),
            setTimeout(() => setPageToast(prev => (prev && prev.key === key ? null : prev)), 4550),
        ];
    }, []);

    useEffect(() => {
        const timers = pageToastTimersRef;
        return () => { timers.current.forEach(clearTimeout); };
    }, []);

    // Merge one thread's media into the batch, keeping it in ascending time
    // order, and hold the reader's position if the insert landed above the fold.
    const ingestMedia = useCallback((items: MediaItem[]) => {
        if (items.length === 0) return;
        scrollAnchorRef.current = captureScrollAnchor();
        const merged = [...mediaRef.current, ...items].sort((a, b) => a.tim - b.tim);
        mediaRef.current = merged;
        for (const m of items) knownMediaIdsRef.current.add(`${m.boardKey}-${m.id}`);
        setMedia(merged);
    }, []);

    // Fetch a set of threads a few at a time, rendering each as it lands. The
    // archive rate-limits wide bursts, so this is what turns "half the threads
    // silently vanished" into "the batch fills in over a few more seconds".
    const loadThreadBatch = useCallback(async (
        threads: ThreadMatch[],
        token: { cancelled: boolean },
    ) => {
        let done = 0;
        // Tracked via an object so the closure's writes are visible to the caller.
        const earliest = { mkey: null as string | null, tim: Number.POSITIVE_INFINITY };

        await fetchThreadMediaStream(threads, ({ media: items, ok }) => {
            done++;
            if (ok) loadedThreadsRef.current++;
            else failedThreadsRef.current++;

            for (const m of items) {
                if (m.tim < earliest.tim) {
                    earliest.tim = m.tim;
                    earliest.mkey = `${m.boardKey}-${m.id}`;
                }
            }

            ingestMedia(items);
            if (token.cancelled) return;

            setStatus(done < threads.length
                ? `Loading ${done}/${threads.length} threads | ${mediaRef.current.length} media items`
                : summarize(loadedThreadsRef.current, mediaRef.current.length, failedThreadsRef.current));
        }, token);

        return earliest.mkey;
    }, [ingestMedia]);

    // ── Initial search ──
    useEffect(() => {
        if (didFetchRef.current === searchKey) return;
        didFetchRef.current = searchKey;

        runTokenRef.current.cancelled = true;
        const token = { cancelled: false };
        runTokenRef.current = token;

        const run = async () => {
            setIsLoading(true);
            setMedia([]);
            mediaRef.current = [];
            setNewItemIds(new Set());
            knownMediaIdsRef.current = new Set<string>();
            setFilenameFilter('');
            setFilenameRegex(false);
            setFilenameFilterOpen(false);
            fetchedThreadsRef.current = [];
            loadedThreadsRef.current = 0;
            failedThreadsRef.current = 0;
            setPageToast(null);
            setStatus('Searching...');

            try {
                const matches = await searchThreads(
                    boardKeys, keywords, megucaThreadCount, archivedParam
                );
                if (token.cancelled) return;

                if (matches.length === 0) {
                    setStatus('No matching threads found.');
                    setIsLoading(false);
                    return;
                }

                fetchedThreadsRef.current = matches;
                setStatus(`Found ${matches.length} threads. Fetching media...`);

                // Oldest first, so each thread's media appends below the last
                // instead of pushing the grid down as the batch fills in.
                await loadThreadBatch([...matches].reverse(), token);
                if (token.cancelled) return;

                if (mediaRef.current.length === 0) setStatus('No media found.');
            } catch (error) {
                console.error('[Search] Error:', error);
                if (!token.cancelled) setStatus('Error occurred while fetching data.');
            } finally {
                if (!token.cancelled) setIsLoading(false);
            }
        };

        run();
    }, [searchKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Load more (archive mode): pick up threads archived since the search ──
    // Not a "next page" — the N threads asked for are the whole result set. This
    // covers the one way that set can change while the page is open: a thread
    // that was still live on 4chan when the search ran (and so was excluded)
    // drops off the catalog and gets archived. Re-running the same search
    // surfaces it, and being the newest thread its media appends at the bottom,
    // right where the button is. Nothing already on screen moves.
    const handleLoadMore = useCallback(async () => {
        if (isLoadingMore || isLoading) return;
        const token = runTokenRef.current;
        setIsLoadingMore(true);
        setStatus('Checking for newly archived threads...');

        try {
            const matches = await searchThreads(boardKeys, keywords, megucaThreadCount, true);
            if (token.cancelled) return;

            const known = new Set(fetchedThreadsRef.current.map(t => `${t.boardKey}:${t.threadId}`));
            const fresh = matches.filter(t => !known.has(`${t.boardKey}:${t.threadId}`));

            if (fresh.length === 0) {
                setStatus(summarize(loadedThreadsRef.current, mediaRef.current.length, failedThreadsRef.current));
                showPageToast('No newly archived threads found.', null);
                return;
            }

            fetchedThreadsRef.current = [...fetchedThreadsRef.current, ...fresh];

            const before = mediaRef.current.length;
            const firstKey = await loadThreadBatch([...fresh].reverse(), token);
            if (token.cancelled) return;

            const added = mediaRef.current.length - before;
            showPageToast(
                added > 0
                    ? `${fresh.length} newly archived thread${fresh.length === 1 ? '' : 's'} · ${added} posts added below`
                    : `${fresh.length} newly archived thread${fresh.length === 1 ? '' : 's'} · no media in ${fresh.length === 1 ? 'it' : 'them'}`,
                added > 0 ? firstKey : null,
            );
        } catch (error) {
            console.error('[LoadMore] Error:', error);
            if (!token.cancelled) setStatus('Error checking for newly archived threads.');
        } finally {
            if (!token.cancelled) setIsLoadingMore(false);
        }
    }, [boardKeys, keywords, megucaThreadCount, isLoading, isLoadingMore, loadThreadBatch, showPageToast]);

    // ── Refresh ──
    const handleRefresh = useCallback(async () => {
        if (isRefreshing || fetchedThreadsRef.current.length === 0) return;
        setIsRefreshing(true);
        setStatus('Checking for new posts...');

        try {
            const allMedia: MediaItem[] = [];
            await fetchThreadMediaStream(fetchedThreadsRef.current, ({ media: items }) => {
                allMedia.push(...items);
            });

            const newMedia = allMedia.filter(m => !knownMediaIdsRef.current.has(`${m.boardKey}-${m.id}`));

            if (newMedia.length > 0) {
                newMedia.sort((a, b) => a.tim - b.tim);
                const combined = [...mediaRef.current, ...newMedia];
                mediaRef.current = combined;
                for (const m of newMedia) knownMediaIdsRef.current.add(`${m.boardKey}-${m.id}`);
                setMedia(combined);
                // Accumulate, don't replace: successive auto-refresh batches all
                // stack below the same "New posts" line until the user scrolls to
                // the bottom (which clears the set and merges them in).
                setNewItemIds(prev => {
                    const next = new Set(prev);
                    for (const m of newMedia) next.add(`${m.boardKey}-${m.id}`);
                    return next;
                });
                setStatus(`${summarize(loadedThreadsRef.current, combined.length, failedThreadsRef.current)} (+${newMedia.length} new)`);
            } else {
                setStatus(`${summarize(loadedThreadsRef.current, mediaRef.current.length, failedThreadsRef.current)} (no new posts)`);
            }
        } catch (error) {
            console.error('[Refresh] Error:', error);
            setStatus('Error checking for new posts.');
        } finally {
            setIsRefreshing(false);
        }
    }, [isRefreshing]);

    // Put the anchored tile back under the reader. Runs before paint so an
    // insert above the fold is never visible as a jump.
    useLayoutEffect(() => {
        const anchor = scrollAnchorRef.current;
        if (!anchor) return;
        scrollAnchorRef.current = null;
        const el = tileFor(anchor.mkey);
        if (!el) return;
        const delta = el.getBoundingClientRect().top - anchor.top;
        if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: 'instant' });
    }, [media]);

    // Opt-in trip to the start of a freshly archived thread's media, from the toast.
    const jumpToPage = useCallback((mkey: string) => {
        const el = tileFor(mkey);
        if (!el) return;
        scrollAnchorRef.current = null;
        window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 80, behavior: 'smooth' });
        setPageToast(null);
    }, []);

    // ── Scroll handling: hide header on scroll down, show back-to-top ──
    useEffect(() => {
        const handleScroll = () => {
            const y = window.scrollY;
            const docHeight = document.documentElement.scrollHeight;
            const distanceFromBottom = docHeight - (y + window.innerHeight);
            setShowScrollTop(y > 400);
            setShowScrollBottom(distanceFromBottom > 400);
            // Reaching the bottom merges the new items in (clears the "New posts"
            // divider). Snapshot tile positions first so the Gallery can FLIP the
            // layout change into a smooth slide instead of a jump.
            if (distanceFromBottom < 80 && newItemIdsRef.current.size > 0) {
                galleryRef.current?.captureMergeStart();
                newItemIdsRef.current = new Set();
                setNewItemIds(new Set());
            }
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

    // Mirror newItemIds into a ref so the (deps-free) scroll handler can read the
    // current value without re-subscribing on every refresh.
    useEffect(() => { newItemIdsRef.current = newItemIds; }, [newItemIds]);

    // Ctrl/Cmd+F opens the filename filter instead of the browser's find bar.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                setFilenameFilterOpen(true);
                requestAnimationFrame(() => filenameInputRef.current?.focus());
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Restore the auto-refresh preferences on mount.
    useEffect(() => {
        setAutoRefresh(localStorage.getItem('mg-auto-refresh') === 'true');
        const storedMs = parseInt(localStorage.getItem('mg-auto-refresh-ms') || '', 10);
        if (storedMs === 60000 || storedMs === 300000) setAutoRefreshMs(storedMs);
    }, []);

    // Auto-refresh: periodically poll the open threads for new posts. Archived
    // threads are dead by definition, so polling them is pure upstream load —
    // and the archive's rate limit is shared with the paging the user does want.
    useEffect(() => {
        if (!autoRefresh || archivedParam) return;
        const id = setInterval(() => { handleRefresh(); }, autoRefreshMs);
        return () => clearInterval(id);
    }, [autoRefresh, autoRefreshMs, archivedParam, handleRefresh]);

    const toggleAutoRefresh = useCallback(() => {
        setAutoRefresh(prev => {
            const next = !prev;
            localStorage.setItem('mg-auto-refresh', String(next));
            return next;
        });
    }, []);

    const setAutoRefreshInterval = useCallback((ms: number) => {
        setAutoRefreshMs(ms);
        localStorage.setItem('mg-auto-refresh-ms', String(ms));
    }, []);

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

                <Gallery ref={galleryRef} media={filteredMedia} newItemIds={newItemIds} />

                {/* Archive mode checks for threads archived since the search; live
                    mode polls the open threads for new posts. The two are mutually
                    exclusive — nothing new is coming to a dead thread, so neither
                    the refresh button nor the auto-refresh toggle belongs there. */}
                {media.length > 0 && archivedParam && (
                    <div className="flex flex-col items-center gap-2.5 pt-3 pb-6">
                        <button
                            onClick={handleLoadMore}
                            disabled={isLoadingMore || isLoading}
                            className="
                                flex items-center gap-2 px-5 py-2
                                bg-[var(--bg-surface)] border border-[var(--border)]
                                text-[var(--text-secondary)] rounded-lg text-sm
                                transition-all duration-150 disabled:opacity-40 cursor-pointer
                                hover:border-[var(--accent)] hover:text-[var(--accent)] hover:shadow-[0_0_12px_-3px_var(--accent-glow)]
                                active:scale-95
                            "
                        >
                            <History size={15} className={isLoadingMore ? 'animate-spin' : ''} />
                            {isLoadingMore ? 'Checking...' : 'Load more posts'}
                        </button>
                    </div>
                )}

                {media.length > 0 && !archivedParam && (
                    <div className="flex flex-col items-center gap-2.5 pt-3 pb-6">
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="
                                flex items-center gap-2 px-5 py-2
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
                        <div className="flex items-center gap-2.5 text-xs text-[var(--text-muted)]">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={autoRefresh}
                                    onChange={toggleAutoRefresh}
                                    className="peer sr-only"
                                />
                                <span className="flex h-4 w-4 items-center justify-center rounded border border-[color:color-mix(in_srgb,var(--border)_70%,white_18%)] bg-[color:color-mix(in_srgb,var(--bg-surface)_82%,white_18%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors peer-checked:border-[var(--accent)] peer-focus-visible:ring-1 peer-focus-visible:ring-[var(--accent)]">
                                    <Check size={11} strokeWidth={3} className={`text-[var(--accent)] transition-opacity ${autoRefresh ? 'opacity-100' : 'opacity-0'}`} />
                                </span>
                                <span>Auto-refresh</span>
                            </label>
                            {autoRefresh && (
                                <select
                                    value={autoRefreshMs}
                                    onChange={e => setAutoRefreshInterval(Number(e.target.value))}
                                    className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-secondary)] cursor-pointer focus:border-[var(--accent)] focus:outline-none"
                                >
                                    <option value={300000}>5m</option>
                                    <option value={60000}>1m</option>
                                </select>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Scroll to top / bottom — stacked rounded squares, fade in/out */}
            <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-3">
                <button
                    onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setHeaderVisible(true); }}
                    className="
                        p-4 bg-[var(--accent)] text-white
                        rounded-xl shadow-lg
                        transition-all duration-300 cursor-pointer
                        hover:brightness-110 hover:scale-105
                        active:scale-90
                    "
                    style={{
                        opacity: showScrollTop ? 1 : 0,
                        pointerEvents: showScrollTop ? 'auto' : 'none',
                        transform: showScrollTop ? 'translateY(0)' : 'translateY(20px)',
                    }}
                    title="Back to top"
                >
                    <ChevronUp size={24} />
                </button>
                <button
                    onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
                    className="
                        p-4 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)]
                        rounded-xl shadow-lg
                        transition-all duration-300 cursor-pointer
                        hover:border-[var(--accent)] hover:text-[var(--accent)] hover:scale-105
                        active:scale-90
                    "
                    style={{
                        opacity: showScrollBottom ? 1 : 0,
                        pointerEvents: showScrollBottom ? 'auto' : 'none',
                        transform: showScrollBottom ? 'translateY(0)' : 'translateY(20px)',
                    }}
                    title="Jump to bottom"
                >
                    <ChevronDown size={24} />
                </button>
            </div>

            {/* Archive check toast — same construction as the download toasts, in
                the pink accent rather than emerald, dropping in from the top edge. */}
            {pageToast && (
                <div className="fixed top-3 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
                    <div
                        className={`flex items-center gap-3 max-w-[min(34rem,92vw)] rounded-xl border border-[color:color-mix(in_srgb,var(--accent)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_18%,var(--bg-elevated))] px-4 py-3 text-[15px] text-[var(--text-primary)] shadow-xl backdrop-blur-sm ${pageToast.exiting ? 'drop-toast-exit' : 'drop-toast-enter'}`}
                    >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                            <History size={16} strokeWidth={2.5} />
                        </span>
                        <span className="truncate">{pageToast.text}</span>
                        {pageToast.jumpTo && (
                            <button
                                onClick={() => jumpToPage(pageToast.jumpTo!)}
                                className="pointer-events-auto shrink-0 rounded-md border border-[color:color-mix(in_srgb,var(--accent)_55%,transparent)] px-2.5 py-1 text-[13px] text-[var(--text-secondary)] transition-colors duration-150 cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)]"
                            >
                                Jump to them
                            </button>
                        )}
                    </div>
                </div>
            )}

            {filteredMedia.length > 0 && <TimeScrollbar />}
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
