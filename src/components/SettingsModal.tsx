'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings as SettingsIcon } from 'lucide-react';
import { loadSettings, saveSettings } from '@/lib/settings';

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [term, setTerm] = useState('');

    useEffect(() => {
        if (!open) return;
        setTerm(loadSettings().defaultSearchTerm);
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    if (!open) return null;

    const updateTerm = (value: string) => {
        setTerm(value);
        saveSettings({ ...loadSettings(), defaultSearchTerm: value });
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            style={{ animation: 'fadeIn 0.15s ease-out' }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
        >
            <div
                className="relative w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/95 shadow-2xl backdrop-blur-xl"
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

                <div className="relative px-7 pb-7 pt-7">
                    <div className="flex items-center gap-2.5">
                        <span
                            className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--accent)]"
                            style={{ backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 80%, transparent)' }}
                        >
                            <SettingsIcon size={18} />
                        </span>
                        <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Settings</h2>
                    </div>

                    <div className="mt-6 flex flex-col gap-6">
                        <SettingRow
                            title="Default search term"
                            description="Pre-fills the search box when you open the home page. Leave empty to start blank."
                        >
                            <input
                                value={term}
                                onChange={e => updateTerm(e.target.value)}
                                placeholder="e.g. kpop"
                                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent-cyan)]"
                            />
                        </SettingRow>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

function SettingRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
            <div className="mb-2 mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">{description}</div>
            {children}
        </div>
    );
}
