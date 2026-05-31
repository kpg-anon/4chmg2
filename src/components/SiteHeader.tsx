'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HelpCircle, Settings, LayoutGrid, Compass } from 'lucide-react';
import AboutModal from '@/components/AboutModal';
import SettingsModal from '@/components/SettingsModal';

export default function SiteHeader({ active }: { active: 'explore' | 'boards' }) {
    const [aboutOpen, setAboutOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    return (
        <>
            <header className="relative z-20 grid grid-cols-2 items-center px-6 py-4 md:grid-cols-3">
                {/* Logo */}
                <Link href="/" className="justify-self-start text-2xl font-black tracking-tight transition-opacity hover:opacity-80">
                    <span className="bg-gradient-to-r from-[var(--accent)] via-purple-400 to-blue-400 bg-clip-text text-transparent">
                        4CHMG2
                    </span>
                </Link>

                {/* Center tabs */}
                <nav className="hidden items-center justify-self-center gap-1 md:flex">
                    <NavTab href="/boards" icon={LayoutGrid} label="Boards" active={active === 'boards'} />
                    <NavTab href="/" icon={Compass} label="Explore" active={active === 'explore'} />
                </nav>

                {/* Right utility icons */}
                <div className="flex items-center justify-self-end gap-1">
                    <IconButton icon={HelpCircle} title="About" onClick={() => setAboutOpen(true)} />
                    <IconButton icon={Settings} title="Settings" onClick={() => setSettingsOpen(true)} />
                </div>
            </header>

            <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
            <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </>
    );
}

function NavTab({ href, icon: Icon, label, active = false }: { href: string; icon: typeof Compass; label: string; active?: boolean }) {
    return (
        <Link
            href={href}
            className={`group relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                active
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
        >
            <Icon size={15} />
            {label}
            <span
                className={`absolute -bottom-px left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-[var(--accent)] transition-all duration-200 ${
                    active ? 'w-6 opacity-100' : 'w-0 opacity-0 group-hover:w-4 group-hover:opacity-40'
                }`}
            />
        </Link>
    );
}

function IconButton({ icon: Icon, title, onClick }: { icon: typeof Settings; title: string; onClick?: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            aria-label={title}
            className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors duration-150 cursor-pointer hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
        >
            <Icon size={18} />
        </button>
    );
}
