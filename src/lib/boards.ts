export type BoardSource = '4chan' | 'easychan' | 'mokachan' | 'desuarchive' | 'dvach';

export interface BoardConfig {
    /** Unique key: "source:id" e.g. "easychan:kr" */
    key: string;
    /** Board short name e.g. "kr", "mu" */
    id: string;
    /** Source site */
    source: BoardSource;
    /** Human-readable board name */
    label: string;
    /** Human-readable site name for UI */
    siteLabel: string;
    /** Base URL for API requests */
    baseUrl: string;
    /** Domain substring for proxy URL matching */
    imageDomain: string;
    /** Whether FlareSolverr is needed to bypass Cloudflare */
    needsCloudflareBypass: boolean;
    /** Uses meguca/vichan API format (vs 4chan API) */
    isMeguca: boolean;
    /** Thread count selector applies (persistent/archive threads) */
    threadCountApplies: boolean;
    /** Search field: where keywords appear ('subject' | 'comment' | 'both') */
    searchField: 'subject' | 'comment' | 'both';
    /**
     * Optional per-board allowlist: subject must contain at least one of these
     * (case-insensitive, punctuation-normalized) for the thread to be eligible.
     * Used to restrict noisy boards to a single general series.
     */
    requiredSubjectKeywords?: string[];
}

export const BOARDS: BoardConfig[] = [
    {
        key: '4ch:mu', id: 'mu', source: '4chan',
        label: 'Music', siteLabel: '4chan',
        baseUrl: 'https://a.4cdn.org',
        imageDomain: 'i.4cdn.org',
        needsCloudflareBypass: false, isMeguca: false, threadCountApplies: false,
        searchField: 'both',
    },
    {
        key: '4ch:trash', id: 'trash', source: '4chan',
        label: 'Off-Topic', siteLabel: '4chan',
        baseUrl: 'https://a.4cdn.org',
        imageDomain: 'i.4cdn.org',
        needsCloudflareBypass: false, isMeguca: false, threadCountApplies: false,
        searchField: 'both',
    },
    {
        key: '4ch:gif', id: 'gif', source: '4chan',
        label: 'GIF', siteLabel: '4chan',
        baseUrl: 'https://a.4cdn.org',
        imageDomain: 'i.4cdn.org',
        needsCloudflareBypass: false, isMeguca: false, threadCountApplies: false,
        searchField: 'both',
    },
    // easychan.net is defunct (2026-05). The BoardSource literal, search/proxy
    // branches, FlareSolverr cookie handling, and Gallery favicon are kept in
    // place so a future Cloudflare-fronted board can be re-enabled by adding a
    // new BOARDS entry — no plumbing needs to be rewritten.
    {
        key: 'mokachan:kr', id: 'kr', source: 'mokachan',
        label: 'Korea', siteLabel: 'Mokachan',
        baseUrl: 'https://mokachan.cafe',
        imageDomain: 'mokachan.cafe',
        needsCloudflareBypass: false, isMeguca: true, threadCountApplies: true,
        searchField: 'both',
    },
    // 2ch.org (Dvach) boards
    {
        key: 'dvach:kpop', id: 'kpop', source: 'dvach',
        label: 'K-pop', siteLabel: '2ch',
        baseUrl: 'https://2ch.org',
        imageDomain: '2ch.org',
        needsCloudflareBypass: false, isMeguca: false, threadCountApplies: true,
        searchField: 'subject',
        // Only the "ПАНТЕОН ... БОГИНЬ" general series; skip off-topic threads
        // like "Девочки подростки..." that incidentally mention k-pop.
        requiredSubjectKeywords: ['пантеон'],
    },
    // Desuarchive boards — foolfuuka archive of 4chan
    // searchField varies: mu has term in subject, trash has term in comment
    {
        key: 'desu:mu', id: 'mu', source: 'desuarchive',
        label: 'Music', siteLabel: 'Desuarchive',
        baseUrl: 'https://desuarchive.org',
        imageDomain: 'desu-usergeneratedcontent.xyz',
        needsCloudflareBypass: false, isMeguca: false, threadCountApplies: true,
        searchField: 'subject',
    },
    {
        key: 'desu:trash', id: 'trash', source: 'desuarchive',
        label: 'Off-Topic', siteLabel: 'Desuarchive',
        baseUrl: 'https://desuarchive.org',
        imageDomain: 'desu-usergeneratedcontent.xyz',
        needsCloudflareBypass: false, isMeguca: false, threadCountApplies: true,
        searchField: 'comment',
    },
];

// ── Supported-site templates (engine + domain) for the board configurator ──
// Custom boards added in-browser reuse one of these already-integrated sites,
// so their image domains are inherently within the proxy allowlist and no API
// route or allowlist change is needed. The site id doubles as the key prefix.
export interface SiteTemplate {
    id: string;
    source: BoardSource;
    siteLabel: string;
    baseUrl: string;
    imageDomain: string;
    needsCloudflareBypass: boolean;
    isMeguca: boolean;
    threadCountApplies: boolean;
    defaultSearchField: 'subject' | 'comment' | 'both';
}

export const SITE_TEMPLATES: Record<string, SiteTemplate> = {
    '4ch': {
        id: '4ch', source: '4chan', siteLabel: '4chan',
        baseUrl: 'https://a.4cdn.org', imageDomain: 'i.4cdn.org',
        needsCloudflareBypass: false, isMeguca: false, threadCountApplies: false,
        defaultSearchField: 'both',
    },
    'mokachan': {
        id: 'mokachan', source: 'mokachan', siteLabel: 'Mokachan',
        baseUrl: 'https://mokachan.cafe', imageDomain: 'mokachan.cafe',
        needsCloudflareBypass: false, isMeguca: true, threadCountApplies: true,
        defaultSearchField: 'both',
    },
    'dvach': {
        id: 'dvach', source: 'dvach', siteLabel: '2ch',
        baseUrl: 'https://2ch.org', imageDomain: '2ch.org',
        needsCloudflareBypass: false, isMeguca: false, threadCountApplies: true,
        defaultSearchField: 'both',
    },
    'desu': {
        id: 'desu', source: 'desuarchive', siteLabel: 'Desuarchive',
        baseUrl: 'https://desuarchive.org', imageDomain: 'desu-usergeneratedcontent.xyz',
        needsCloudflareBypass: false, isMeguca: false, threadCountApplies: true,
        defaultSearchField: 'both',
    },
};

/** Site ids surfaced as choices in the board configurator (desu rides the Archive toggle). */
export const CONFIGURABLE_SITE_IDS = ['4ch', 'mokachan', 'dvach'] as const;

/** Board ids map to a URL path segment, so keep them to safe path characters. */
export const VALID_BOARD_ID = /^[a-z0-9_]+$/i;

/**
 * Build a full board config from a supported-site template + board id. Used both
 * to render custom chips (client) and to synthesize a config for a custom key on
 * the server, so user-defined boards work end-to-end without a static entry.
 */
export function buildBoardConfig(siteId: string, boardId: string, label?: string): BoardConfig | undefined {
    const site = SITE_TEMPLATES[siteId];
    if (!site || !VALID_BOARD_ID.test(boardId)) return undefined;
    return {
        key: `${siteId}:${boardId}`,
        id: boardId,
        source: site.source,
        label: label?.trim() || `/${boardId}/`,
        siteLabel: site.siteLabel,
        baseUrl: site.baseUrl,
        imageDomain: site.imageDomain,
        needsCloudflareBypass: site.needsCloudflareBypass,
        isMeguca: site.isMeguca,
        threadCountApplies: site.threadCountApplies,
        searchField: site.defaultSearchField,
    };
}

/** Look up a board config by its unique key, synthesizing custom boards on supported sites. */
export function getBoardByKey(key: string): BoardConfig | undefined {
    const builtin = BOARDS.find(b => b.key === key);
    if (builtin) return builtin;
    // Custom board on a supported site, e.g. "4ch:a" → synthesize from template.
    const idx = key.indexOf(':');
    if (idx <= 0) return undefined;
    return buildBoardConfig(key.slice(0, idx), key.slice(idx + 1));
}

/** Look up a board config by matching a URL against imageDomain */
export function getBoardByUrl(url: string): BoardConfig | undefined {
    return BOARDS.find(b => url.includes(b.imageDomain));
}

/**
 * Parse a board param string from the URL.
 * Supports format: "4ch:mu,easychan:kr,desu:trash"
 * Legacy fallback: bare "mu" defaults to 4ch, bare "kr" defaults to easychan.
 */
export function parseBoardKeys(param: string): string[] {
    return param.split(',').filter(Boolean).map(raw => {
        if (raw.includes(':')) return raw;
        if (raw === 'kr') return 'easychan:kr';
        return `4ch:${raw}`;
    });
}

/** Check if any selected boards need a thread count input */
export function hasThreadCountBoards(keys: string[]): boolean {
    return keys.some(k => {
        const config = getBoardByKey(k);
        return config?.threadCountApplies ?? false;
    });
}

/** Check if any selected boards are desuarchive */
export function hasDesuarchiveBoards(keys: string[]): boolean {
    return keys.some(k => k.startsWith('desu:'));
}

/** Get the non-desuarchive 4chan boards available */
export function getFourchanBoards(): BoardConfig[] {
    return BOARDS.filter(b => b.source === '4chan');
}

/** Get the meguca boards */
export function getMegucaBoards(): BoardConfig[] {
    return BOARDS.filter(b => b.isMeguca);
}

/** Get the desuarchive boards */
export function getDesuarchiveBoards(): BoardConfig[] {
    return BOARDS.filter(b => b.source === 'desuarchive');
}

/** Get the dvach boards */
export function getDvachBoards(): BoardConfig[] {
    return BOARDS.filter(b => b.source === 'dvach');
}
