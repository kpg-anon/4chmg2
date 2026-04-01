'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, Check } from 'lucide-react';
import { hasThreadCountBoards, getFourchanBoards, getMegucaBoards, getDesuarchiveBoards, type BoardConfig } from '@/lib/boards';

interface SearchFormProps {
    isLoading?: boolean;
    initialBoardKeys?: string[];
    initialKeywords?: string;
    initialThreadCount?: number;
    initialArchived?: boolean;
    compact?: boolean;
    /** When true, show full board picker inline (for search page header) */
    showBoardPicker?: boolean;
}

export default function SearchForm({
    isLoading = false,
    initialBoardKeys = ['4ch:mu', '4ch:trash'],
    initialKeywords = 'kpop',
    initialThreadCount = 1,
    initialArchived = false,
    compact = false,
    showBoardPicker = false,
}: SearchFormProps) {
    const router = useRouter();
    const desuarchiveBoards = useMemo(() => getDesuarchiveBoards(), []);

    // selectedKeys only holds 4chan + meguca keys (what the buttons represent).
    // Desu keys in the URL are converted back to their 4chan counterparts.
    const [selectedKeys, setSelectedKeys] = useState<string[]>(() => {
        if (!initialBoardKeys.length) return ['4ch:mu', '4ch:trash'];
        return initialBoardKeys.map(k => {
            if (k.startsWith('desu:')) return `4ch:${k.split(':')[1]}`;
            return k;
        }).filter((k, i, arr) => arr.indexOf(k) === i);
    });
    const [query, setQuery] = useState(initialKeywords);
    const [threadCount, setThreadCount] = useState(initialThreadCount);
    const [useDesuarchive, setUseDesuarchive] = useState(
        initialArchived || initialBoardKeys.some(k => k.startsWith('desu:'))
    );
    const [threadCountEdit, setThreadCountEdit] = useState('');
    const [isEditingThreadCount, setIsEditingThreadCount] = useState(false);

    const showThreadCount = useMemo(
        () => hasThreadCountBoards(selectedKeys) || useDesuarchive,
        [selectedKeys, useDesuarchive]
    );

    const selectedFourchanIds = useMemo(
        () => selectedKeys.filter(k => k.startsWith('4ch:')).map(k => k.split(':')[1]),
        [selectedKeys]
    );
    const hasFourchanSelected = selectedFourchanIds.length > 0;
    const hasMegucaSelected = useMemo(
        () => selectedKeys.some(k => !k.startsWith('4ch:') && !k.startsWith('desu:')),
        [selectedKeys]
    );

    const toggleBoard = (key: string) => {
        setSelectedKeys(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const toggleDesuarchive = () => {
        setUseDesuarchive(prev => !prev);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || selectedKeys.length === 0) return;
        const keywords = query.split('|').map(k => k.trim()).filter(Boolean);

        // When desu is checked, replace 4chan keys with desu equivalents
        const boardKeys = selectedKeys.map(k => {
            if (useDesuarchive && k.startsWith('4ch:')) {
                const desuKey = `desu:${k.split(':')[1]}`;
                if (desuarchiveBoards.some(db => db.key === desuKey)) return desuKey;
            }
            return k;
        });

        const boardsParam = boardKeys.join(',');
        const queryParam = keywords.join('|');
        const archivedParam = useDesuarchive ? '&archived=1' : '';
        router.push(`/search?boards=${boardsParam}&q=${encodeURIComponent(queryParam)}&threads=${threadCount}${archivedParam}`);
    };

    const fourchanBoards = getFourchanBoards();
    const megucaBoards = getMegucaBoards();

    // ── Board picker row (shared between full and compact+showBoardPicker modes) ──
    const boardPickerContent = (
        <div className="flex flex-wrap items-center gap-1.5">
            {fourchanBoards.map(b => (
                <BoardBtn key={b.key} board={b} selected={selectedKeys.includes(b.key)} onClick={() => toggleBoard(b.key)} />
            ))}
            {megucaBoards.map(b => (
                <BoardBtn key={b.key} board={b} selected={selectedKeys.includes(b.key)} onClick={() => toggleBoard(b.key)} showSiteLabel />
            ))}
            <div className="flex-1" />
            {/* Desuarchive toggle + thread count — right-aligned */}
            {(hasFourchanSelected || hasMegucaSelected) && (
                <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer select-none border border-dashed transition-all duration-150
                    ${useDesuarchive
                        ? 'bg-sky-400/10 border-sky-400/50 text-sky-400'
                        : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}>
                    <input type="checkbox" checked={useDesuarchive} onChange={toggleDesuarchive} className="hidden" />
                    {useDesuarchive ? 'Archived' : 'Archive'}
                    {useDesuarchive && <Check className="w-2.5 h-2.5" />}
                </label>
            )}
            {showThreadCount && (
                <div className="flex items-center gap-1 text-[var(--text-muted)] ml-1">
                    <span className="text-xs">N:</span>
                    <input
                        type="number" min="1" max="100"
                        value={isEditingThreadCount ? threadCountEdit : threadCount}
                        onFocus={e => { setThreadCountEdit(String(threadCount)); setIsEditingThreadCount(true); requestAnimationFrame(() => e.target.select()); }}
                        onChange={e => setThreadCountEdit(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setThreadCount(Math.max(1, parseInt(threadCountEdit) || 1)); setIsEditingThreadCount(false); (e.target as HTMLInputElement).blur(); } }}
                        onBlur={() => { setThreadCount(Math.max(1, parseInt(threadCountEdit) || 1)); setIsEditingThreadCount(false); }}
                        className="w-10 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)] px-1 py-0.5 rounded text-xs text-center outline-none focus:border-[var(--accent)] transition-colors caret-transparent selection:bg-[var(--accent)]"
                    />
                </div>
            )}
        </div>
    );

    // ── Compact mode: search page header ──
    if (compact) {
        return (
            <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
                    <input
                        type="text" value={query} onChange={e => setQuery(e.target.value)}
                        placeholder="Search keywords..."
                        className="w-full bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder-[var(--text-muted)] py-2 pl-9 pr-3 rounded-lg text-sm border border-[var(--border)] focus:border-[var(--accent)] outline-none transition-colors"
                    />
                </div>
                <button
                    type="submit" disabled={isLoading || selectedKeys.length === 0}
                    className="px-4 py-2 bg-[var(--accent)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all active:scale-95 cursor-pointer shrink-0"
                >
                    {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Search'}
                </button>
                {/* Board picker to the right of search button */}
                {showBoardPicker && boardPickerContent}
            </form>
        );
    }

    // ── Full mode: homepage ──
    return (
        <div className="w-full max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                {/* Board buttons + desu checkbox + thread count — all one row */}
                {boardPickerContent}

                {/* Search Input + Button */}
                <div className="flex gap-2 bg-[var(--bg-surface)] p-1.5 rounded-xl border border-[var(--border)]">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
                        <input
                            type="text" value={query} onChange={e => setQuery(e.target.value)}
                            placeholder="Search keywords (use | for OR)"
                            className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] py-2.5 pl-9 pr-3 rounded-lg outline-none text-sm"
                        />
                    </div>
                    <button
                        type="submit" disabled={isLoading || selectedKeys.length === 0}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[var(--accent)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold active:scale-95 transition-all cursor-pointer"
                    >
                        {isLoading && <Loader2 className="animate-spin w-4 h-4" />}
                        {isLoading ? 'Searching...' : 'Search'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function BoardBtn({ board, selected, onClick, showSiteLabel = false }: { board: BoardConfig; selected: boolean; onClick: () => void; showSiteLabel?: boolean }) {
    return (
        <button
            type="button" onClick={onClick}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 border cursor-pointer
                ${selected
                    ? 'bg-[var(--accent)]/15 border-[var(--accent)]/50 text-[var(--accent)]'
                    : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
        >
            /{board.id}/{showSiteLabel ? ` ${board.siteLabel}` : ''}
            {selected && <Check className="w-2.5 h-2.5" />}
        </button>
    );
}
