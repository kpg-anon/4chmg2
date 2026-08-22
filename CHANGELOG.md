# Changelog

## 2026-08-22
### Source-status probes measure the API, not the favicon (v1.5.1)
- **Homepage status dots now reflect real reachability** — the panel inferred health by fetching each site's `favicon.ico` through `/api/proxy`, which measured the wrong thing twice over. Desuarchive serves `/favicon.ico` behind a Cloudflare browser challenge (403 to any server-side client) while its API answers normally, and the proxy's disk cache has no TTL — so a favicon fetched once kept reporting "OK" indefinitely after the probe itself began failing. Production showed green off a five-week-old cached file while dev, which never had that entry warmed, showed DOWN; neither reflected whether the source actually worked. A new `/api/status` route `HEAD`s the endpoint each source is genuinely consumed through (catalog JSON for 4chan/Mokachan/2ch, `/_/api/chan/thread/` for the archive), derived from the board configs so the probes can't drift from real traffic
- **Favicons are served locally** from `public/favicons/` instead of hotlinked through the image proxy — they're decoration, and routing them through the proxy coupled them to upstream availability and the media cache
- Probe results are memoised process-wide for 60s behind a single-flight guard, so a busy homepage can't burst requests at a source that's already struggling; `HEAD` falls back to `GET` so a 405 can't produce a false DOWN, and the archive is probed via its thread endpoint rather than search, which is rate-limited
- The panel now re-checks every 60s instead of taking a single page-load snapshot

## 2026-08-13
### Archive fallback, media filtering, and lightbox chrome (v1.5.0)
- **Dead 4chan media resolves to the archive** — when 4chan has pruned or deleted a file, the proxy transparently serves desuarchive's copy and caches it under the original URL, so a broken tile becomes a one-time lookup instead of a permanent gap. Resolution is two-stage: the archived URL is derived from the 4chan timestamp (no API call), falling back to an exact `/_/api/chan/post/` lookup via a post-number hint the client passes as `&p=`. The lookup is needed because the archive stores one copy per content hash, so a repost's media points at whichever upload it saw first — derivation alone lands about 70% of the time. `/api/warm` resolves the derivable cases during pre-warm
- **Non-media uploads are dropped from Mokachan and 2ch** — both accept audio, archives, and text (`.flac`, `.mp3`, `.txt`, …) that the gallery can't render and that only ever produced broken tiles; extraction now keeps images and video only
- **Corrected the meguca file-type map** — verified against live Mokachan payloads. `.flac` was resolving to `.mjpeg`, PDFs claimed `.mp4`, and type 14 was mapped to `.webp` when it's meguca's `NO_FILE`. This also **fixes MP4s posted with a VP9 codec tag**, which were building `.webm` URLs that 404'd
- **Custom thumbnail-strip scrollbar** — a rounded rail that auto-hides, replacing the native bar. Firefox reserves layout space for its scrollbars, and inside the fixed-height strip that reservation pushed the thumbs into vertical overflow, so the strip grew a second, vertical bar and lost thumbnail height to a permanent horizontal one. The strip now reserves an 8px gutter of its own for the rail, so a fully magnified thumbnail can never collide with it; the rail shows only while scrolling, while the pointer is in the gutter, or mid-drag
- **Video controls auto-hide** — the lightbox transport bar now appears only while the pointer is over the video (and stays up mid-scrub), instead of sitting over the bottom of the frame the whole time
- Firefox scrollbars app-wide now match the existing WebKit styling via `scrollbar-width` / `scrollbar-color`

## 2026-06-28
### New-posts locate highlight root-cause fix (v1.4.2)
- **Fix blank highlighted thumbnails after closing new-post media** — new auto-refresh tiles no longer rely on an `opacity-0` + `animation-fill-mode: forwards` fade-in state; the locate-on-exit pulse can now run without replacing the fade animation and making the already-loaded thumbnail transparent

## 2026-06-26
### New-posts fix (v1.4.1)
- **New-posts thumbnails no longer flash blank on locate-on-exit** — freshly arrived "new posts" tiles now load eagerly on mount instead of waiting for the lazy-load observer, so they're decoded by the time you open one and exit the lightbox; the locate-on-exit highlight lands on the actual thumbnail rather than a blank tile

## 2026-06-23
### Gallery & search UX polish (v1.4.0)
A polish release focused on smoother, more orienting interactions across search and the lightbox.
- **Auto-refresh** — a search toggle that periodically polls open threads for new posts, with a **1m / 5m** interval dropdown (default 5m), persisted to localStorage (`mg-auto-refresh`, `mg-auto-refresh-ms`)
- **"New posts" divider + smooth merge** — fresh items land below a full-width divider line and successive batches accumulate below it (rather than replacing); they merge into the main grid only when you scroll to the bottom. The merge plays a viewport-space FLIP animation (captured at the exact merge instant via an imperative `GalleryHandle.captureMergeStart()`) so thumbnails slide into place instead of jolting
- **Locate-on-exit** — closing the lightbox smooth-scrolls the last-viewed tile back to centre and highlights it: a cyan ring/glow pulse on the tile plus a full-bleed grey band across its whole row, both fading out (~1.8s), so you keep your place
- **Download-complete toasts** — green-check "[filename] saved" notifications that slide in, stack, and fade out on both search and lightbox views (portaled above the lightbox); anchored bottom-left and raised above the thumbnail strip while it's docked
- **webp downloads fixed** — lightbox image saves now download via a blob instead of opening webp in a new tab (browsers ignore `<a download>` for inline-renderable types); videos keep the direct path
- **Rotation always reads clockwise**, even after a horizontal flip — the underlying `rotate()` stays stable across flip toggles (so flipping only animates the mirror, never a rotation "rewind"); direction is normalized at the rotate step, and the canvas-based transformed download matches the on-screen transform
- **Scroll-to-bottom button** stacked below the back-to-top button
- **Thumbnail-strip mouse-wheel scrolling** — the lightbox strip now translates vertical wheel `deltaY` to horizontal scroll (previously only trackpad `deltaX` worked)
- **Gallery zoom centering** — scroll-zoom stays centred until the media fills the viewport, then follows the cursor
- **Ctrl/Cmd+F** opens the in-app filename filter instead of the browser find bar
- **Video download overlay icon** — the results-grid download overlay shows a video icon for videos vs the image icon for images
- **Live status dots** — the home-page "OK" source-status dots now pulse (steady emerald glow + expanding ring) to signal live data
- **Time-scrollbar freshness** — the relative-time label re-computes every 30s so it doesn't go stale on long sessions

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
