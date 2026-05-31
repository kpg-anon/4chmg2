'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Github, Layers, Zap, Download, ShieldCheck } from 'lucide-react';

// Tracks package.json via NEXT_PUBLIC_APP_VERSION (set in next.config.ts), so
// the displayed version never needs manual updating — just bump package.json.
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '';
const REPO_URL = 'https://github.com/kpg-anon/4chmg2';

const HIGHLIGHTS = [
    { icon: Layers, text: 'Search one keyword and pull matching images & videos from 4chan, Mokachan, 2ch, and the Desuarchive into a single gallery.' },
    { icon: Zap, text: 'Fast self-hosted proxy with aggressive thumbnail caching — smooth scrolling, no skeleton flashes.' },
    { icon: Download, text: 'Full-screen lightbox with zoom, rotate, slideshow, and one-click batch ZIP downloads.' },
    { icon: ShieldCheck, text: 'Privacy-first: no accounts, no tracking, zero data collection.' },
];

export default function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            style={{ animation: 'fadeIn 0.15s ease-out' }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="About 4CHMG2"
        >
            <div
                className="relative w-full max-w-xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/95 shadow-2xl backdrop-blur-xl"
                onClick={e => e.stopPropagation()}
            >
                <div aria-hidden="true" className="glow-radial pointer-events-none absolute -top-12 left-1/2 h-40 w-80 -translate-x-1/2 opacity-40 blur-2xl" />

                <button
                    type="button"
                    onClick={onClose}
                    title="Close (Esc)"
                    aria-label="Close"
                    className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors cursor-pointer hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                >
                    <X size={18} />
                </button>

                <div className="relative px-7 pb-7 pt-8">
                    {/* Header */}
                    <div className="flex items-center gap-3.5">
                        <img src="/mascot.webp" alt="" aria-hidden="true" className="h-14 w-14 shrink-0" draggable={false} />
                        <div>
                            <h2 className="bg-gradient-to-r from-[var(--accent)] via-purple-400 to-blue-400 bg-clip-text text-2xl font-black leading-none tracking-tight text-transparent">
                                4CHMG2
                            </h2>
                            <div className="mt-1.5 font-mono text-[11px] tracking-wide text-[var(--text-muted)]">
                                4chan Media Gallery 2.0 · v{APP_VERSION}
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <p className="mt-5 text-sm leading-relaxed text-[var(--text-secondary)]">
                        A cross-imageboard media aggregator and gallery viewer. Enter a keyword once and 4CHMG2 gathers
                        every matching image and video from multiple imageboards into one fast, unified gallery — built
                        with K-pop fans in mind, but it works for any board.
                    </p>

                    {/* Highlights */}
                    <ul className="mt-5 flex flex-col gap-3">
                        {HIGHLIGHTS.map((h, i) => {
                            const Icon = h.icon;
                            return (
                                <li key={i} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                                    <span
                                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--accent)]"
                                        style={{ backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 80%, transparent)' }}
                                    >
                                        <Icon size={15} />
                                    </span>
                                    <span className="leading-relaxed">{h.text}</span>
                                </li>
                            );
                        })}
                    </ul>

                    {/* Footer */}
                    <div className="mt-7 flex items-center justify-between border-t border-[var(--border)] pt-5">
                        <span className="font-mono text-[11px] text-[var(--text-muted)]">Open source · MIT License</span>
                        <a
                            href={REPO_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        >
                            <Github size={16} />
                            View on GitHub
                        </a>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
