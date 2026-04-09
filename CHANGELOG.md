# Changelog

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
