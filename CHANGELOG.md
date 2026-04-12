# Changelog

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
