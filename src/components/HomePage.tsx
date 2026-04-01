'use client';

import SearchForm from '@/components/SearchForm';

export default function HomePage() {
    return (
        <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
            {/* Branding bar */}
            <header className="px-6 pt-4 pb-2 shrink-0">
                <h1 className="text-2xl font-black tracking-tight">
                    <span className="bg-gradient-to-r from-[var(--accent)] via-purple-400 to-blue-400 bg-clip-text text-transparent">
                        4CHMG2
                    </span>
                </h1>
            </header>

            {/* Mascot starts right below the header, search bar lands near center */}
            <div className="flex flex-col items-center px-6 pt-0">
                {/* Mascot */}
                <img
                    src="/3f6cbd855343dff141df45f6c254a463aba221.png"
                    alt="4CHMG"
                    className="w-80 h-80 sm:w-96 sm:h-96 mb-1"
                    draggable={false}
                />

                {/* Search Form — directly below mascot */}
                <SearchForm />
            </div>
        </div>
    );
}
