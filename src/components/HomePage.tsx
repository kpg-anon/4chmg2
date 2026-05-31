'use client';

import { useEffect, useState } from 'react';
import { Zap, ShieldCheck, Sparkles, Heart } from 'lucide-react';
import SearchForm from '@/components/SearchForm';
import SiteHeader from '@/components/SiteHeader';

// ── Upstream sources surfaced in the status panel ──
const SOURCES = [
    { key: '4chan', label: '4chan', favicon: 'https://s.4cdn.org/image/favicon.ico' },
    { key: 'mokachan', label: 'Mokachan', favicon: 'https://mokachan.cafe/assets/favicons/favicon.ico' },
    { key: 'dvach', label: '2ch', favicon: 'https://2ch.org/favicon.ico' },
    { key: 'desuarchive', label: 'Desuarchive', favicon: 'https://desuarchive.org/favicon.ico' },
] as const;

type SourceState = 'checking' | 'ok' | 'down';

const FEATURES = [
    { icon: Zap, title: 'Fast Proxy', desc: 'Ultra-low latency connection to global imageboards', color: 'var(--accent)' },
    { icon: ShieldCheck, title: 'No Tracking', desc: 'Privacy first architecture with zero data collection', color: 'var(--accent-cyan)' },
    { icon: Sparkles, title: 'Always Fresh', desc: 'Real-time thread updates and media synchronization', color: 'var(--accent-emerald)' },
    { icon: Heart, title: 'Built for Fans', desc: 'Designed by enthusiasts for the ultimate experience', color: 'var(--accent)' },
];

const proxyUrl = (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`;

export default function HomePage() {
    return (
        <div className="grid-bg relative flex min-h-screen flex-col overflow-hidden bg-[var(--bg-base)]">
            {/* Soft radial glow behind the hero, simulating light-emitting hardware */}
            <div
                aria-hidden="true"
                className="glow-radial pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] max-w-[120vw] -translate-x-1/2 opacity-60 blur-2xl"
            />

            <SiteHeader active="explore" />

            <main className="relative flex flex-1 flex-col items-center px-6">
                {/* Source status — docked left on wide screens */}
                <SourceStatus />

                {/* Mascot hero with fade mask */}
                <div className="relative mt-2 flex justify-center">
                    <img
                        src="/mascot.webp"
                        alt=""
                        aria-hidden="true"
                        width={1397}
                        height={1393}
                        fetchPriority="high"
                        loading="eager"
                        className="relative w-72 h-72 sm:w-80 sm:h-80"
                        style={{
                            WebkitMaskImage: 'linear-gradient(to bottom, black 78%, transparent 100%)',
                            maskImage: 'linear-gradient(to bottom, black 78%, transparent 100%)',
                        }}
                        draggable={false}
                    />
                </div>

                {/* Search Form — board chips + input */}
                <div className="relative z-10 -mt-1 w-full">
                    <SearchForm />
                </div>

                {/* Feature cards */}
                <FeatureCards />
            </main>
        </div>
    );
}

function SourceStatus() {
    const [status, setStatus] = useState<Record<string, SourceState>>(
        () => Object.fromEntries(SOURCES.map(s => [s.key, 'checking'])) as Record<string, SourceState>
    );

    useEffect(() => {
        let cancelled = false;
        const timers: ReturnType<typeof setTimeout>[] = [];
        SOURCES.forEach(s => {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 7000);
            timers.push(timer);
            fetch(proxyUrl(s.favicon), { signal: ctrl.signal })
                .then(r => { if (!cancelled) setStatus(prev => ({ ...prev, [s.key]: r.ok ? 'ok' : 'down' })); })
                .catch(() => { if (!cancelled) setStatus(prev => ({ ...prev, [s.key]: 'down' })); })
                .finally(() => clearTimeout(timer));
        });
        return () => { cancelled = true; timers.forEach(clearTimeout); };
    }, []);

    return (
        <div className="absolute left-6 top-2 hidden flex-col gap-2.5 lg:flex xl:left-10">
            {SOURCES.map(s => (
                <div key={s.key} className="flex items-center gap-2 text-xs">
                    <img src={proxyUrl(s.favicon)} alt="" className="h-3.5 w-3.5 rounded-sm opacity-80" />
                    <span className="text-[var(--text-secondary)]">{s.label}</span>
                    <StatusDot state={status[s.key]} />
                </div>
            ))}
        </div>
    );
}

function StatusDot({ state }: { state: SourceState }) {
    const label = state === 'ok' ? 'OK' : state === 'down' ? 'DOWN' : '···';
    const color =
        state === 'ok' ? 'var(--accent-emerald)'
        : state === 'down' ? 'var(--error, #ffb4ab)'
        : 'var(--text-muted)';
    return (
        <span className="flex items-center gap-1 font-mono text-[10px] tracking-wide" style={{ color }}>
            <span
                className={`h-1.5 w-1.5 rounded-full ${state === 'checking' ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: color, boxShadow: state === 'ok' ? `0 0 6px ${color}` : undefined }}
            />
            {label}
        </span>
    );
}

function FeatureCards() {
    return (
        <div className="mt-10 mb-10 grid w-full max-w-4xl grid-cols-2 gap-4 lg:grid-cols-4">
            {FEATURES.map(f => {
                const Icon = f.icon;
                return (
                    <div
                        key={f.title}
                        className="relative flex flex-col items-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]/70 px-4 py-5 text-center backdrop-blur-sm"
                    >
                        <span
                            className="mb-3 flex h-9 w-9 items-center justify-center rounded-md"
                            style={{ color: f.color, backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 80%, transparent)' }}
                        >
                            <Icon size={20} />
                        </span>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">{f.title}</div>
                        <div className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{f.desc}</div>
                    </div>
                );
            })}
        </div>
    );
}
