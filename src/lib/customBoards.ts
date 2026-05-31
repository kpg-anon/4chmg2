// Client-only persistence for user-defined boards and hidden built-ins.
// Custom boards are stored as lightweight defs; full configs are built on demand
// from the supported-site templates in boards.ts.

import { buildBoardConfig, SITE_TEMPLATES, VALID_BOARD_ID, type BoardConfig } from './boards';

export interface CustomBoardDef {
    siteId: string;
    boardId: string;
    label: string;
}

const CUSTOM_KEY = 'mg-custom-boards';
const HIDDEN_KEY = 'mg-hidden-boards';

function readJSON<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function writeJSON(key: string, value: unknown): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* quota / private mode — best effort */
    }
}

export function loadCustomBoardDefs(): CustomBoardDef[] {
    const defs = readJSON<CustomBoardDef[]>(CUSTOM_KEY, []);
    if (!Array.isArray(defs)) return [];
    return defs.filter(d => d && SITE_TEMPLATES[d.siteId] && VALID_BOARD_ID.test(d.boardId));
}

export function saveCustomBoardDefs(defs: CustomBoardDef[]): void {
    writeJSON(CUSTOM_KEY, defs);
}

export function loadHiddenKeys(): string[] {
    const keys = readJSON<string[]>(HIDDEN_KEY, []);
    return Array.isArray(keys) ? keys.filter(k => typeof k === 'string') : [];
}

export function saveHiddenKeys(keys: string[]): void {
    writeJSON(HIDDEN_KEY, keys);
}

/** Built configs for every stored custom board def (invalid defs dropped). */
export function getCustomBoardConfigs(): BoardConfig[] {
    return loadCustomBoardDefs()
        .map(d => buildBoardConfig(d.siteId, d.boardId, d.label))
        .filter((b): b is BoardConfig => Boolean(b));
}
