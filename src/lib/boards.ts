export type BoardSource = '4chan' | 'easychan' | 'mokachan' | 'desuarchive';

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
    {
        key: 'easychan:kr', id: 'kr', source: 'easychan',
        label: 'Korea', siteLabel: 'Easychan',
        baseUrl: 'https://easychan.net',
        imageDomain: 'easychan.net',
        needsCloudflareBypass: true, isMeguca: true, threadCountApplies: true,
        searchField: 'both',
    },
    {
        key: 'mokachan:kr', id: 'kr', source: 'mokachan',
        label: 'Korea', siteLabel: 'Mokachan',
        baseUrl: 'https://mokachan.cafe',
        imageDomain: 'mokachan.cafe',
        needsCloudflareBypass: false, isMeguca: true, threadCountApplies: true,
        searchField: 'both',
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

/** Look up a board config by its unique key */
export function getBoardByKey(key: string): BoardConfig | undefined {
    return BOARDS.find(b => b.key === key);
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
