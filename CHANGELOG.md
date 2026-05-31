# Changelog

## 2026-05-31
### Major homepage revamp + settings, board configurator, and time scrollbar (v1.3.0)
This release is headlined by a **major homepage revamp** that overhauls the landing experience, alongside several new features across search and the gallery.
- **Major homepage revamp** — a ground-up redesign to a "Deep Space Utility" command-center layout: grid background, neon magenta/cyan accents, radial glow, mascot with fade mask, a live source-status panel that pings each upstream, and feature cards. Adopt Inter + JetBrains Mono via `next/font`
- **Shared top navigation** (`SiteHeader`) with Explore / Boards tabs plus About and Settings entries
- **About modal** with project info and repo link; the displayed version now auto-tracks `package.json` via `NEXT_PUBLIC_APP_VERSION` (exposed in `next.config.ts`) and never needs manual editing
- **Settings modal** (localStorage `mg-settings`) with a configurable default search term (empty for new users) that pre-fills the home search box; built on an extensible `SettingRow` for future options
- **In-browser Board Configurator** (`/boards`) — add custom boards on the supported sites (4chan, Mokachan, 2ch), hide built-ins, and hide/delete custom boards, persisted per-browser (`mg-custom-boards`, `mg-hidden-boards`). `getBoardByKey` synthesizes a config for custom keys from `SITE_TEMPLATES`, so custom boards work end-to-end with no API-route or proxy-allowlist changes (board ids validated, domains already allowlisted)
- **Relative-time scrollbar** on search results — a custom right-edge rail with drag-scrub, track-click, and right-edge hover reveal showing the current position's relative post time; hides the native scrollbar while active
- **Dock-style thumbnail magnify** in the lightbox strip — thumbnails scale toward the cursor with smooth proximity falloff (rAF-throttled, windowed, capped to fit the strip)
- **Search form** — board chips centered on the homepage with the Archive/`N` controls held right; the meguca/dvach thread-count `N` input now appears only with the Archive toggle so selecting mokachan/2ch no longer shifts the layout; board chips are equally translucent toggled or not; new homepage placeholder `Search keyword(s) (eg kpop | k-pop)`
- Allowlist `s.4cdn.org` in the media proxy so the 4chan source-status check resolves; extract `formatRelativeTime`/`formatExactTime` into `src/lib/time.ts`

## 2026-05-25
### Batch selection and ZIP downloads (v1.2.0)
- Add bottom-left gallery selection mode for choosing visible search results without covering thumbnails
- Add batch ZIP export with generated files named `4chmg-selection-{epoch}.zip`
- Add hover/focus `S` shortcut on search thumbnails for direct media download
- Show transient darkened thumbnail download overlays with a high-contrast Lucide `ImageDown` icon while downloads are active
- Use composite board/post media keys so refreshed search results do not collide across boards
- Register `eslint-plugin-react-hooks` explicitly and downgrade React Compiler memoization preservation findings to warnings

## 2026-05-24
### Enter key always submits search (v1.1.1)
- After clicking a board toggle the button kept keyboard focus, so pressing Enter re-activated it and untoggled the board instead of submitting
- Intercept Enter on `BoardBtn` and route it to `form.requestSubmit()` so the keyboard flow is "click board → type query → Enter"
- Space still toggles boards via the browser default

### Aggressive thumbnail prefetch (v1.1.0)
- Bump `IntersectionObserver` `rootMargin` on grid thumbnails `200px` → `1500px` so the browser starts fetching well ahead of scroll
- Bump outbound HTTP keep-alive pool `maxSockets` 16 → 64, `maxFreeSockets` 8 → 16 to avoid socket queueing during burst scroll + parallel cache warmup
- Add client-side grid prefetcher (`useGridPrefetch` in `Gallery.tsx`): walks every thumbnail in the result set via `new Image()` at `fetchPriority: 'low'`, throttled to 6 concurrent, kicked off via `requestIdleCallback` so initial paint isn't blocked
- Add server-side warmup endpoint `POST /api/warm`: client posts thumbnail URL batches; server fans out fetches at concurrency 4 into the disk cache with in-flight dedup and skip-if-cached. Same hostname allowlist as `/api/proxy`. Max 500 URLs per request
- Add 10 GB cap + LRU-by-mtime eviction to the Node-side `.media-cache/` so aggressive prefetching can't fill the production 50 GB SSD. Eviction runs every 250 writes, single-flighted
- New `isCached(url)` helper in `mediaCache.ts` for cheap presence checks

### Deprecate easychan
- Remove `easychan:kr` from the board picker; easychan.net is defunct
- Strike through the Easychan row in the README supported-boards table
- Retain easychan handling in search, proxy allowlist, Gallery favicon, and FlareSolverr cookie code so a future Cloudflare-fronted board can be wired up by re-adding a single BOARDS entry

### 2ch /kpop/ search accuracy (v1.0.1)
- Normalize hyphens, spaces, and punctuation when matching dvach catalog subjects so `kpop` matches both `KPOP` and `K-POP` (OP format changed at thread #2000)
- Add `requiredSubjectKeywords` allowlist to `BoardConfig`; restrict `dvach:kpop` to the `ПАНТЕОН ... БОГИНЬ` general series so off-topic threads that incidentally mention k-pop are excluded
- In archive mode, drop the most-recent matching thread from dvach results (mirrors meguca behavior) so the active general is never returned alongside the archive batch

## 2026-04-12
### New board: 2ch.org /kpop/
- Add 2ch.org (Dvach) as a new board source with keyword-filtered catalog search
- Support multi-file posts (2ch.org allows multiple attachments per post)
- Add `/kpop/ 2ch` board toggle in search form
- Add 2ch.org favicon to gallery timestamp display
- Add 2ch.org media proxy support with proper referer handling

## 2026-04-09
### Media loading performance overhaul
- Add server-side disk cache for proxied media (`.media-cache/`)
- Add HTTP agent connection pooling with keep-alive to eliminate repeated TLS handshakes
- Add Range request support (206 Partial Content) for video seeking
- Add `Content-Length` and `Accept-Ranges` headers on all proxy responses
- Add nginx proxy cache layer with thundering-herd protection (`proxy_cache_lock`)
- Add `fetchPriority="high"` on lightbox image, `priority: "low"` on prefetch requests
- Cap video blob prefetch to files under 4MB
- Remove `keepTunnelAlive` no-op
- Remove thumbnail strip windowing — all thumbnails now render with lazy loading via IntersectionObserver
