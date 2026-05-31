'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, RotateCcw, Info } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import {
    BOARDS, SITE_TEMPLATES, CONFIGURABLE_SITE_IDS, VALID_BOARD_ID,
    getFourchanBoards, getMegucaBoards, getDvachBoards,
} from '@/lib/boards';
import {
    loadCustomBoardDefs, saveCustomBoardDefs, loadHiddenKeys, saveHiddenKeys,
    type CustomBoardDef,
} from '@/lib/customBoards';

const SITE_GROUPS = [
    { siteId: '4ch', builtins: getFourchanBoards },
    { siteId: 'mokachan', builtins: getMegucaBoards },
    { siteId: 'dvach', builtins: getDvachBoards },
] as const;

const BUILTIN_KEYS = new Set(BOARDS.map(b => b.key));

export default function BoardsConfigurator() {
    const [defs, setDefs] = useState<CustomBoardDef[]>([]);
    const [hidden, setHidden] = useState<Set<string>>(() => new Set());
    const [siteId, setSiteId] = useState<string>(CONFIGURABLE_SITE_IDS[0]);
    const [boardId, setBoardId] = useState('');
    const [label, setLabel] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        setDefs(loadCustomBoardDefs());
        setHidden(new Set(loadHiddenKeys()));
    }, []);

    const customByKey = useMemo(() => {
        const m = new Map<string, CustomBoardDef>();
        defs.forEach(d => m.set(`${d.siteId}:${d.boardId}`, d));
        return m;
    }, [defs]);

    const persistDefs = (next: CustomBoardDef[]) => { setDefs(next); saveCustomBoardDefs(next); };
    const persistHidden = (next: Set<string>) => { setHidden(next); saveHiddenKeys([...next]); };

    const addBoard = () => {
        const id = boardId.trim().toLowerCase();
        if (!VALID_BOARD_ID.test(id)) {
            setError('Board id must be letters, numbers, or underscores (e.g. "a", "pol").');
            return;
        }
        const key = `${siteId}:${id}`;
        if (BUILTIN_KEYS.has(key) || customByKey.has(key)) {
            setError(`That board already exists (${key}).`);
            return;
        }
        persistDefs([...defs, { siteId, boardId: id, label: label.trim() }]);
        setBoardId('');
        setLabel('');
        setError('');
    };

    const removeCustom = (key: string) => {
        persistDefs(defs.filter(d => `${d.siteId}:${d.boardId}` !== key));
        if (hidden.has(key)) {
            const next = new Set(hidden);
            next.delete(key);
            persistHidden(next);
        }
    };

    const toggleHidden = (key: string) => {
        const next = new Set(hidden);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        persistHidden(next);
    };

    const resetAll = () => {
        persistDefs([]);
        persistHidden(new Set());
    };

    const hasChanges = defs.length > 0 || hidden.size > 0;

    return (
        <div className="grid-bg relative flex min-h-screen flex-col bg-[var(--bg-base)]">
            <div aria-hidden="true" className="glow-radial pointer-events-none absolute left-1/2 top-0 h-[420px] w-[760px] max-w-[120vw] -translate-x-1/2 opacity-40 blur-2xl" />

            <SiteHeader active="boards" />

            <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Board Configurator</h1>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                    Add your own boards to the selection row on the Explore page, or hide ones you don&apos;t use.
                    Boards run on the existing integrated sites &mdash; pick a site, enter its board id, and it appears as a chip.
                    Settings are saved in this browser.
                </p>

                {/* Add form */}
                <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/70 p-4 backdrop-blur-sm">
                    <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--text-muted)]">Add a board</div>
                    <div className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-[var(--text-muted)]">Site</span>
                            <select
                                value={siteId}
                                onChange={e => { setSiteId(e.target.value); setError(''); }}
                                className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-cyan)]"
                            >
                                {CONFIGURABLE_SITE_IDS.map(id => (
                                    <option key={id} value={id}>{SITE_TEMPLATES[id].siteLabel}</option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-[var(--text-muted)]">Board id</span>
                            <input
                                value={boardId}
                                onChange={e => { setBoardId(e.target.value); setError(''); }}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBoard(); } }}
                                placeholder="e.g. a"
                                className="h-9 w-28 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-cyan)]"
                            />
                        </label>
                        <label className="flex flex-1 flex-col gap-1">
                            <span className="text-xs text-[var(--text-muted)]">Label <span className="opacity-60">(optional)</span></span>
                            <input
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBoard(); } }}
                                placeholder="e.g. Anime & Manga"
                                className="h-9 min-w-32 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-cyan)]"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={addBoard}
                            className="flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-all duration-150 cursor-pointer hover:brightness-110 hover:shadow-[0_0_15px_var(--accent-glow)] active:scale-95"
                        >
                            <Plus size={16} /> Add
                        </button>
                    </div>
                    {error && <div className="mt-2.5 text-xs text-[var(--accent)]">{error}</div>}
                    <div className="mt-3 flex items-start gap-1.5 text-xs text-[var(--text-muted)]">
                        <Info size={13} className="mt-0.5 shrink-0" />
                        <span>The board id is the path segment on the site (e.g. 4chan&apos;s <span className="font-mono">/a/</span> &rarr; id <span className="font-mono">a</span>). New boards appear as chips on the Explore page in this browser.</span>
                    </div>
                </section>

                {/* Board groups */}
                <div className="mt-6 flex flex-col gap-5">
                    {SITE_GROUPS.map(group => {
                        const tmpl = SITE_TEMPLATES[group.siteId];
                        const builtinBoards = group.builtins();
                        const customBoards = defs
                            .filter(d => d.siteId === group.siteId)
                            .map(d => ({ key: `${d.siteId}:${d.boardId}`, id: d.boardId, label: d.label || `/${d.boardId}/` }));
                        return (
                            <section key={group.siteId}>
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="text-sm font-semibold text-[var(--text-primary)]">{tmpl.siteLabel}</span>
                                    <span className="font-mono text-[10px] text-[var(--text-muted)]">{tmpl.imageDomain}</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    {builtinBoards.map(b => (
                                        <BoardRow
                                            key={b.key}
                                            board={b}
                                            hidden={hidden.has(b.key)}
                                            kind="builtin"
                                            onToggleHidden={() => toggleHidden(b.key)}
                                        />
                                    ))}
                                    {customBoards.map(b => (
                                        <BoardRow
                                            key={b.key}
                                            board={b}
                                            hidden={hidden.has(b.key)}
                                            kind="custom"
                                            onToggleHidden={() => toggleHidden(b.key)}
                                            onRemove={() => removeCustom(b.key)}
                                        />
                                    ))}
                                    {builtinBoards.length === 0 && customBoards.length === 0 && (
                                        <div className="text-xs text-[var(--text-muted)]">No boards.</div>
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>

                {hasChanges && (
                    <div className="mt-8 border-t border-[var(--border)] pt-5">
                        <button
                            type="button"
                            onClick={resetAll}
                            className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        >
                            <RotateCcw size={15} /> Reset to defaults
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

function BoardRow({
    board, hidden, kind, onToggleHidden, onRemove,
}: {
    board: { key: string; id: string; label: string };
    hidden: boolean;
    kind: 'builtin' | 'custom';
    onToggleHidden?: () => void;
    onRemove?: () => void;
}) {
    return (
        <div className={`flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg-elevated)]/40 px-3 py-2 transition-opacity ${hidden ? 'opacity-45' : ''}`}>
            <div className="flex items-center gap-2 text-sm">
                <span className="font-mono text-[var(--text-primary)]">/{board.id}/</span>
                <span className="text-[var(--text-secondary)]">{board.label}</span>
                {kind === 'custom' && (
                    <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--accent)]">custom</span>
                )}
            </div>
            <div className="flex items-center gap-1">
                {onToggleHidden && (
                    <button
                        type="button"
                        onClick={onToggleHidden}
                        title={hidden ? 'Show on Explore' : 'Hide from Explore'}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors cursor-pointer hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                    >
                        {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                )}
                {onRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        title="Delete board"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors cursor-pointer hover:bg-[var(--bg-surface)] hover:text-red-400"
                    >
                        <Trash2 size={15} />
                    </button>
                )}
            </div>
        </div>
    );
}
