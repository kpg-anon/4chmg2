// Client-only user preferences, persisted to localStorage. Defaults mirror the
// app's prior hardcoded behavior so existing users see no change until they opt in.

export interface AppSettings {
    /** Pre-fills the home-page search box. Empty string = start blank. */
    defaultSearchTerm: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
    defaultSearchTerm: '',
};

const SETTINGS_KEY = 'mg-settings';

export function loadSettings(): AppSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        // Merge over defaults so a stored value of '' is preserved while any
        // newly-added settings fall back to their defaults.
        return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveSettings(settings: AppSettings): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        /* quota / private mode — best effort */
    }
}
