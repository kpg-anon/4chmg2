'use client';

import { useState, useCallback, useRef, useEffect, useLayoutEffect, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { MediaItem } from '@/lib/api';
import {
    X, ExternalLink, Download, Play, Pause,
    FlipHorizontal, RotateCw, Maximize2, FileVideo, Image as ImageIcon,
    ChevronDown, ChevronUp, Volume2, VolumeX
} from 'lucide-react';

// ── Nav Arrow Base64 Images ──
const BASE64_PREV = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF4AAABsCAYAAADjYAXIAAAACXBIWXMAAAUTAAAFEwFaO8pPAAAFyWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4xLWMwMDEgNzkuMTQ2Mjg5OSwgMjAyMy8wNi8yNS0yMDowMTo1NSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI1LjAgKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyMy0xMi0xOVQxOToyOTo1MS0wNTowMCIgeG1wOk1vZGlmeURhdGU9IjIwMjMtMTItMTlUMTk6NDQ6MTAtMDU6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjMtMTItMTlUMTk6NDQ6MTAtMDU6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOmE5N2IxMWQ1LWE0NTctZjg0Yy1iOWNiLTJkYWNjNzQ4NzY5ZCIgeG1wTU06RG9jdW1lbnRJRD0i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";
const BASE64_NEXT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF4AAABsCAYAAADjYAXIAAAACXBIWXMAAAUTAAAFEwFaO8pPAAAFyWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4xLWMwMDEgNzkuMTQ2Mjg5OSwgMjAyMy8wNi8yNS0yMDowMTo1NSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI1LjAgKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyMy0xMi0xOVQxOToyOTo1MS0wNTowMCIgeG1wOk1vZGlmeURhdGU9IjIwMjMtMTItMTlUMTk6NDI6NDQtMDU6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjMtMTItMTlUMTk6NDI6NDQtMDU6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOmFkY2I5Y2I0LWZmZmYtNzk0Mi1hM2U4LWYxOTcwYTZmM2M0NSIgeG1wTU06RG9jdW1lbnRJRD0i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";

interface GalleryProps {
    media: MediaItem[];
    initialSelectedIndex?: number;
    newItemIds?: Set<number>;
}

const VIDEO_EXTS = ['.webm', '.mp4'];
const proxyUrl = (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`;

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

function LazyThumb({ src, alt, className, style }: { src: string; alt: string; className: string; style?: React.CSSProperties }) {
    const imgRef = useRef<HTMLImageElement>(null);
    const retriesRef = useRef(0);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const img = imgRef.current;
        if (!img) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    img.src = src;
                    observer.unobserve(img);
                }
            },
            { rootMargin: '200px' }
        );

        observer.observe(img);
        return () => observer.disconnect();
    }, [src]);

    const handleError = useCallback(() => {
        if (retriesRef.current < MAX_RETRIES) {
            retriesRef.current++;
            const img = imgRef.current;
            if (img) {
                setTimeout(() => {
                    img.src = '';
                    img.src = src;
                }, RETRY_DELAY * retriesRef.current);
            }
        }
    }, [src]);

    return (
        <img
            ref={imgRef}
            alt={alt}
            className={className}
            style={{ ...style, opacity: loaded ? 1 : 0, transition: 'opacity 0.2s ease, scale 0.3s ease, filter 0.3s ease' }}
            onLoad={() => setLoaded(true)}
            onError={handleError}
        />
    );
}

function formatSize(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatRelativeTime(tim: number): string {
    if (!tim) return '';
    const diff = Date.now() - tim;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
}

function formatExactTime(tim: number): string {
    if (!tim) return '';
    const d = new Date(tim);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const min = String(d.getMinutes()).padStart(2, '0');
    const tz = d.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || '';
    return `${mm}${dd}${yy} ${h}:${min}${ampm} ${tz}`;
}

const SOURCE_FAVICONS: Record<string, string> = {
    '4chan': 'https://s.4cdn.org/image/favicon.ico',
    desuarchive: 'https://desuarchive.org/favicon.ico',
    mokachan: 'https://mokachan.cafe/assets/favicons/favicon.ico',
    easychan: 'https://easychan.net/assets/favicons/favicon.ico',
};


export default function Gallery({ media, initialSelectedIndex, newItemIds }: GalleryProps) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(initialSelectedIndex ?? null);
    const lastViewedIndexRef = useRef<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [slideshowInterval, setSlideshowInterval] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('mg-slideshow-interval');
            return stored ? parseInt(stored, 10) : 10;
        }
        return 10;
    });
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
    const [mediaLoaded, setMediaLoaded] = useState(false);
    const [overlayVisible, setOverlayVisible] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [intervalEditValue, setIntervalEditValue] = useState('');
    const [isEditingInterval, setIsEditingInterval] = useState(false);
    const [thumbDocked, setThumbDocked] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('mg-thumb-docked') !== 'false';
        }
        return true;
    });

    // Transform state — refs for imperative DOM updates (smooth drag/pinch)
    const transformRef = useRef<HTMLDivElement>(null);
    const zoomRef = useRef(1);
    const panRef = useRef({ x: 0, y: 0 });
    const isFlippedRef = useRef(false);
    const rotationRef = useRef(0);
    const mediaRotateRef = useRef<HTMLDivElement>(null);
    const didDragRef = useRef(false);
    const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const isDraggingRef = useRef(false);
    const initialPinchRef = useRef<{ distance: number; scale: number; midX: number; midY: number; panX: number; panY: number } | null>(null);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    const imgRef = useRef<HTMLImageElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const thumbnailStripRef = useRef<HTMLDivElement>(null);
    const slideshowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const precacheRef = useRef<Set<string>>(new Set());
    const blobCacheRef = useRef<Map<string, string>>(new Map());

    // Video control state
    const [isVideoPaused, setIsVideoPaused] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('mg-video-muted') === 'true';
        }
        return false;
    });
    const [seekbarValue, setSeekbarValue] = useState(0);
    const seekbarRafRef = useRef<number | null>(null);
    const frameDurationRef = useRef(1 / 30);
    const lastFrameTimeRef = useRef(-1);
    const contentAreaRef = useRef<HTMLDivElement>(null);
    const videoWrapperRef = useRef<HTMLDivElement>(null);
    const [speedOverlay, setSpeedOverlay] = useState<{ text: string; key: number } | null>(null);
    const speedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [selectedVideoSrc, setSelectedVideoSrc] = useState('');

    useEffect(() => { setPortalTarget(document.body); }, []);

    // Continuous seekbar update loop — runs at display refresh rate while video is playing
    useEffect(() => {
        if (selectedIndex === null || isVideoPaused) {
            if (seekbarRafRef.current) { cancelAnimationFrame(seekbarRafRef.current); seekbarRafRef.current = null; }
            return;
        }
        const tick = () => {
            if (videoRef.current) {
                const { currentTime, duration } = videoRef.current;
                if (duration > 0) setSeekbarValue(currentTime / duration);
            }
            seekbarRafRef.current = requestAnimationFrame(tick);
        };
        seekbarRafRef.current = requestAnimationFrame(tick);
        return () => { if (seekbarRafRef.current) cancelAnimationFrame(seekbarRafRef.current); };
    }, [selectedIndex, isVideoPaused]);

    // Measure actual frame duration via requestVideoFrameCallback
    useEffect(() => {
        const video = videoRef.current;
        if (!video || selectedIndex === null || isVideoPaused) { lastFrameTimeRef.current = -1; return; }
        if (!('requestVideoFrameCallback' in video)) return;
        lastFrameTimeRef.current = -1;
        let id: number;
        const onFrame = (_now: DOMHighResTimeStamp, meta: VideoFrameCallbackMetadata) => {
            if (lastFrameTimeRef.current >= 0) {
                const delta = meta.mediaTime - lastFrameTimeRef.current;
                if (delta > 0 && delta < 0.2) frameDurationRef.current = delta;
            }
            lastFrameTimeRef.current = meta.mediaTime;
            id = video.requestVideoFrameCallback(onFrame);
        };
        id = video.requestVideoFrameCallback(onFrame);
        return () => video.cancelVideoFrameCallback(id);
    }, [selectedIndex, isVideoPaused]);

    useEffect(() => {
        if (selectedIndex !== null) {
            lastViewedIndexRef.current = selectedIndex;
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            const idx = lastViewedIndexRef.current;
            if (idx !== null) {
                const el = document.getElementById(`media-${idx}`);
                if (el) el.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        }
        return () => { document.body.style.overflow = ''; };
    }, [selectedIndex]);

    useEffect(() => {
        if (selectedIndex !== null && thumbnailStripRef.current) {
            const activeThumb = thumbnailStripRef.current.children[selectedIndex] as HTMLElement | undefined;
            if (activeThumb) activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center' });
        }
    }, [selectedIndex]);

    // Fullscreen change tracking
    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    // Overlay auto-hide in fullscreen or slideshow
    useEffect(() => {
        if (overlayTimeoutRef.current) { clearTimeout(overlayTimeoutRef.current); overlayTimeoutRef.current = null; }
        if ((isFullscreen || isPlaying) && !isEditingInterval) {
            const delay = isPlaying ? 300 : 1500;
            overlayTimeoutRef.current = setTimeout(() => setOverlayVisible(false), delay);
        } else if (!isFullscreen && !isPlaying) {
            setOverlayVisible(true);
        }
        return () => { if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current); };
    }, [isFullscreen, isPlaying, isEditingInterval]);

    const applyTransform = useCallback(() => {
        if (transformRef.current) {
            transformRef.current.style.transform = `scale(${zoomRef.current}) translate(${panRef.current.x}px, ${panRef.current.y}px)`;
        }
        if (mediaRotateRef.current) {
            const flip = isFlippedRef.current ? -1 : 1;
            mediaRotateRef.current.style.transform = `scaleX(${flip}) rotate(${rotationRef.current}deg)`;
        }
        // Resize video wrapper to match rotated visual dimensions
        const wrapper = videoWrapperRef.current;
        const video = videoRef.current;
        if (wrapper && video && video.clientWidth > 0) {
            const rot = ((rotationRef.current % 360) + 360) % 360;
            const swapped = rot === 90 || rot === 270;
            if (swapped) {
                wrapper.style.width = `${video.clientHeight}px`;
                wrapper.style.height = `${video.clientWidth}px`;
            } else {
                wrapper.style.width = '';
                wrapper.style.height = '';
            }
        }
    }, []);

    const resetTransform = useCallback(() => {
        zoomRef.current = 1;
        panRef.current = { x: 0, y: 0 };
        isFlippedRef.current = false;
        rotationRef.current = 0;
        // Disable transition to prevent unflip/unrotate animation during navigation
        if (mediaRotateRef.current) mediaRotateRef.current.style.transition = 'none';
        if (videoWrapperRef.current) { videoWrapperRef.current.style.width = ''; videoWrapperRef.current.style.height = ''; }
        setDimensions(null);
        setMediaLoaded(false);
        setIsVideoPaused(false);
        setSeekbarValue(0);
        applyTransform();
        requestAnimationFrame(() => {
            if (mediaRotateRef.current) mediaRotateRef.current.style.transition = 'transform 0.15s ease-out';
        });
    }, [applyTransform]);

    // Slideshow timer — waits for media to load, skips timer for videos (uses onEnded instead)
    useEffect(() => {
        if (slideshowTimerRef.current) { clearTimeout(slideshowTimerRef.current); slideshowTimerRef.current = null; }
        if (isPlaying && selectedIndex !== null && mediaLoaded) {
            const currentItem = media[selectedIndex];
            const isVideo = currentItem && VIDEO_EXTS.includes(currentItem.ext);
            if (!isVideo) {
                slideshowTimerRef.current = setTimeout(() => {
                    setSelectedIndex(prev => prev === null ? null : (prev + 1) % media.length);
                    resetTransform();
                }, slideshowInterval * 1000);
            }
        }
        return () => { if (slideshowTimerRef.current) clearTimeout(slideshowTimerRef.current); };
    }, [isPlaying, selectedIndex, media, slideshowInterval, mediaLoaded, resetTransform]);

    // Precache upcoming media — fetches next 3 items as blobs for videos, Image() for images
    useEffect(() => {
        if (selectedIndex === null || media.length === 0) return;
        const LOOKAHEAD = 3;
        for (let i = 1; i <= LOOKAHEAD; i++) {
            const idx: number = (selectedIndex + i) % media.length;
            if (idx === selectedIndex) continue;
            const item = media[idx];
            const url = proxyUrl(item.url);
            if (precacheRef.current.has(url)) continue;
            precacheRef.current.add(url);
            const isVideo = VIDEO_EXTS.includes(item.ext);
            if (isVideo) {
                if (item.size > 0 && item.size < 4 * 1024 * 1024) {
                    fetch(url, { priority: 'low' } as RequestInit)
                        .then(res => res.blob())
                        .then(blob => { blobCacheRef.current.set(url, URL.createObjectURL(blob)); })
                        .catch(() => {});
                }
            } else {
                const img = new Image();
                img.src = url;
            }
        }
    }, [selectedIndex, media]);

    // Revoke blob URLs on unmount
    useEffect(() => {
        const blobCache = blobCacheRef.current;
        return () => {
            blobCache.forEach(url => URL.revokeObjectURL(url));
            blobCache.clear();
        };
    }, []);

    // Apply transform after lightbox renders
    useEffect(() => {
        if (selectedIndex !== null) requestAnimationFrame(applyTransform);
    }, [selectedIndex, applyTransform]);

    // Skip loading flash when navigating to already-cached media
    useLayoutEffect(() => {
        if (selectedIndex === null) return;
        const item = media[selectedIndex];
        if (!item) return;
        const isVideo = VIDEO_EXTS.includes(item.ext);
        if (isVideo) {
            if (blobCacheRef.current.has(proxyUrl(item.url))) setMediaLoaded(true);
        } else {
            const img = imgRef.current;
            if (img && img.complete && img.naturalWidth > 0) setMediaLoaded(true);
        }
    }, [selectedIndex, media]);

    // Reposition video controls when media loads
    useEffect(() => {
        if (mediaLoaded) requestAnimationFrame(applyTransform);
    }, [mediaLoaded, applyTransform]);

    // Reposition controls on window resize
    useEffect(() => {
        const onResize = () => applyTransform();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [applyTransform]);

    const handleNext = useCallback(() => { setSelectedIndex(prev => prev === null ? null : (prev + 1) % media.length); resetTransform(); }, [media.length, resetTransform]);
    const handlePrev = useCallback(() => { setSelectedIndex(prev => prev === null ? null : (prev - 1 + media.length) % media.length); resetTransform(); }, [media.length, resetTransform]);
    const toggleSlideshow = useCallback(() => setIsPlaying(p => !p), []);
    const toggleFullscreen = useCallback(() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen().catch(() => {}); }, []);
    const closeLightbox = useCallback(() => { setSelectedIndex(null); setIsPlaying(false); setOverlayVisible(true); }, []);

    const toggleThumbDocked = useCallback(() => {
        setThumbDocked(d => { const next = !d; localStorage.setItem('mg-thumb-docked', String(next)); return next; });
    }, []);

    const handleSave = useCallback(async () => {
        const item = selectedIndex !== null ? media[selectedIndex] : null;
        if (!item) return;

        const itemProxyUrl = proxyUrl(item.url);
        const filename = item.filename + item.ext;
        const isVideo = VIDEO_EXTS.includes(item.ext);

        const hasTransform = isFlippedRef.current || rotationRef.current !== 0;

        // Videos or untransformed: direct download
        if (isVideo || !hasTransform) {
            const a = document.createElement('a');
            a.href = itemProxyUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
        }

        // Transformed image: draw to canvas with flip/rotation
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = itemProxyUrl;
            await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; });

            const rot = ((rotationRef.current % 360) + 360) % 360;
            const swapDims = rot === 90 || rot === 270;
            const canvas = document.createElement('canvas');
            canvas.width = swapDims ? img.naturalHeight : img.naturalWidth;
            canvas.height = swapDims ? img.naturalWidth : img.naturalHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.translate(canvas.width / 2, canvas.height / 2);
            if (isFlippedRef.current) ctx.scale(-1, 1);
            ctx.rotate(rot * Math.PI / 180);
            ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

            const ext = item.ext.toLowerCase();
            const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                : ext === '.webp' ? 'image/webp'
                : 'image/png';
            const quality = mimeType === 'image/jpeg' ? 0.92
                : mimeType === 'image/webp' ? 0.90
                : undefined;

            canvas.toBlob(blob => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, mimeType, quality);
        } catch {
            // Fallback to direct download
            const a = document.createElement('a');
            a.href = itemProxyUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    }, [selectedIndex, media]);

    useEffect(() => {
        const item = selectedIndex !== null ? media[selectedIndex] : null;
        if (!item || !VIDEO_EXTS.includes(item.ext)) {
            setSelectedVideoSrc('');
            return;
        }

        const proxiedUrl = proxyUrl(item.url);
        setSelectedVideoSrc(blobCacheRef.current.get(proxiedUrl) || proxiedUrl);
    }, [selectedIndex, media]);

    useEffect(() => {
        if (selectedIndex === null) return;
        const handler = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowLeft': handlePrev(); break;
                case 'ArrowRight': handleNext(); break;
                case ' ': e.preventDefault(); toggleSlideshow(); break;
                case 'Escape': closeLightbox(); break;
                case 'f': case 'F': toggleFullscreen(); break;
                case 'h': case 'H': isFlippedRef.current = !isFlippedRef.current; applyTransform(); break;
                case 's': case 'S': handleSave(); break;
                case 't': case 'T': toggleThumbDocked(); break;
                case 'm': case 'M':
                    if (videoRef.current) {
                        videoRef.current.muted = !videoRef.current.muted;
                    }
                    break;
                case ',': case '<':
                    if (videoRef.current && videoRef.current.paused) {
                        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - frameDurationRef.current);
                    }
                    break;
                case '.': case '>':
                    if (videoRef.current && videoRef.current.paused) {
                        videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + frameDurationRef.current);
                    }
                    break;
                case '[':
                    if (videoRef.current) {
                        videoRef.current.playbackRate = Math.max(0.25, videoRef.current.playbackRate - 0.25);
                        setSpeedOverlay({ text: `${videoRef.current.playbackRate}x`, key: Date.now() });
                        if (speedTimeoutRef.current) clearTimeout(speedTimeoutRef.current);
                        speedTimeoutRef.current = setTimeout(() => setSpeedOverlay(null), 3000);
                    }
                    break;
                case ']':
                    if (videoRef.current) {
                        videoRef.current.playbackRate = Math.min(2, videoRef.current.playbackRate + 0.25);
                        setSpeedOverlay({ text: `${videoRef.current.playbackRate}x`, key: Date.now() });
                        if (speedTimeoutRef.current) clearTimeout(speedTimeoutRef.current);
                        speedTimeoutRef.current = setTimeout(() => setSpeedOverlay(null), 3000);
                    }
                    break;
                case '\\':
                    if (videoRef.current) {
                        videoRef.current.playbackRate = 1;
                        setSpeedOverlay({ text: '1x', key: Date.now() });
                        if (speedTimeoutRef.current) clearTimeout(speedTimeoutRef.current);
                        speedTimeoutRef.current = setTimeout(() => setSpeedOverlay(null), 3000);
                    }
                    break;
                case 'r': case 'R':
                    rotationRef.current += 90;
                    applyTransform();
                    break;
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedIndex, handleNext, handlePrev, toggleSlideshow, toggleFullscreen, closeLightbox, applyTransform, handleSave, toggleThumbDocked]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault(); e.stopPropagation();
        const oldZoom = zoomRef.current;
        const newZoom = Math.max(0.1, Math.min(10, e.deltaY > 0 ? oldZoom * 0.9 : oldZoom * 1.1));
        // Adjust pan so zoom centers on cursor position
        const cr = contentAreaRef.current?.getBoundingClientRect();
        if (cr) {
            const cx = e.clientX - (cr.left + cr.width / 2);
            const cy = e.clientY - (cr.top + cr.height / 2);
            panRef.current = {
                x: panRef.current.x + cx * (1 / newZoom - 1 / oldZoom),
                y: panRef.current.y + cy * (1 / newZoom - 1 / oldZoom),
            };
        }
        zoomRef.current = newZoom;
        applyTransform();
    }, [applyTransform]);

    const getPointerDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
        Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        didDragRef.current = false;
        transformRef.current?.setPointerCapture(e.pointerId);
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointersRef.current.size === 1) {
            isDraggingRef.current = true;
            if (transformRef.current) {
                transformRef.current.style.cursor = 'grabbing';
                transformRef.current.style.transition = 'none';
            }
        }
        if (pointersRef.current.size === 2) {
            isDraggingRef.current = false;
            const pts = Array.from(pointersRef.current.values());
            const dist = getPointerDistance(pts[0], pts[1]);
            initialPinchRef.current = {
                distance: dist, scale: zoomRef.current,
                midX: (pts[0].x + pts[1].x) / 2, midY: (pts[0].y + pts[1].y) / 2,
                panX: panRef.current.x, panY: panRef.current.y,
            };
        }
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!pointersRef.current.has(e.pointerId)) return;
        const last = pointersRef.current.get(e.pointerId)!;
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointersRef.current.size === 1 && isDraggingRef.current) {
            const dx = e.clientX - last.x;
            const dy = e.clientY - last.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) didDragRef.current = true;
            const z = zoomRef.current;
            panRef.current = { x: panRef.current.x + dx / z, y: panRef.current.y + dy / z };
        } else if (pointersRef.current.size === 2 && initialPinchRef.current) {
            const pts = Array.from(pointersRef.current.values());
            const newDist = getPointerDistance(pts[0], pts[1]);
            const newMidX = (pts[0].x + pts[1].x) / 2;
            const newMidY = (pts[0].y + pts[1].y) / 2;

            // Scale from initial pinch distance
            zoomRef.current = Math.max(0.1, Math.min(10,
                initialPinchRef.current.scale * (newDist / initialPinchRef.current.distance)
            ));

            // Pan follows midpoint movement
            const z = zoomRef.current;
            panRef.current = {
                x: initialPinchRef.current.panX + (newMidX - initialPinchRef.current.midX) / z,
                y: initialPinchRef.current.panY + (newMidY - initialPinchRef.current.midY) / z,
            };
        }
        applyTransform();
    }, [applyTransform]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        pointersRef.current.delete(e.pointerId);
        if (pointersRef.current.size === 0) {
            isDraggingRef.current = false;
            if (transformRef.current) {
                transformRef.current.style.cursor = 'grab';
                transformRef.current.style.transition = 'transform 0.1s ease-out';
            }
            if (!didDragRef.current && videoRef.current) {
                if (videoRef.current.paused) {
                    void videoRef.current.play().catch(() => {});
                } else {
                    videoRef.current.pause();
                }
            }
        } else if (pointersRef.current.size === 1) {
            // Transitioned from pinch back to single-finger drag
            isDraggingRef.current = true;
        }
        if (pointersRef.current.size < 2) initialPinchRef.current = null;
    }, []);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        zoomRef.current = 1;
        panRef.current = { x: 0, y: 0 };
        applyTransform();
    }, [applyTransform]);

    const handleMouseMove = useCallback(() => {
        if (!(isFullscreen || isPlaying) || isEditingInterval) return;
        setOverlayVisible(true);
        if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
        overlayTimeoutRef.current = setTimeout(() => setOverlayVisible(false), 2000);
    }, [isFullscreen, isPlaying, isEditingInterval]);

    const selectedItem = selectedIndex !== null ? media[selectedIndex] : null;

    const getSourceLink = (item: MediaItem) => {
        if (item.source === 'desuarchive') return `https://desuarchive.org/${item.boardId}/thread/${item.threadId}#${item.id}`;
        if (item.source === '4chan') return `https://boards.4chan.org/${item.boardId}/thread/${item.threadId}#p${item.id}`;
        if (item.source === 'easychan') return `https://easychan.net/${item.boardId}/${item.threadId}#p${item.id}`;
        if (item.source === 'mokachan') return `https://mokachan.cafe/${item.boardId}/${item.threadId}#p${item.id}`;
        return '#';
    };

    const overlayFadeStyle: React.CSSProperties = {
        opacity: overlayVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: overlayVisible ? 'auto' : 'none',
    };


    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-4">
                {media.map((item, index) => {
                    const isNew = newItemIds?.has(item.id);
                    const isVideo = VIDEO_EXTS.includes(item.ext);
                    return (
                        <button
                            key={`${item.boardKey}-${item.id}`}
                            id={`media-${index}`}
                            onClick={() => { setSelectedIndex(index); resetTransform(); }}
                            className={`group relative aspect-square bg-[var(--bg-surface)] rounded-lg overflow-hidden border-2 border-[var(--border)] hover:border-[var(--accent)] transition-[border-color] duration-150 cursor-pointer outline-none ${isNew ? 'opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]' : ''}`}
                        >
                            <LazyThumb src={proxyUrl(item.thumbnail)} alt={item.filename} className="object-cover w-full h-full group-hover:scale-105 group-hover:brightness-[0.85]" style={{ transformOrigin: 'center' }} />
                            <div className="absolute bottom-1.5 right-1.5">
                                <span className="text-white/80 bg-black/50 p-1 rounded text-xs inline-flex">
                                    {isVideo ? <FileVideo size={12} /> : <ImageIcon size={12} />}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {selectedItem && portalTarget && createPortal(
                <div className="fixed inset-0 z-[9999] flex flex-col bg-black/95" onClick={closeLightbox} onMouseMove={handleMouseMove} style={{ animation: 'fadeIn 0.15s ease-out', cursor: !overlayVisible ? 'none' : undefined }}>
                    {/* Toolbar */}
                    <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300" onClick={e => e.stopPropagation()} style={overlayFadeStyle}>
                        <div className="flex gap-2 items-center">
                            <div className="text-white/70 bg-black/40 px-3 py-1 rounded-full text-sm font-mono">{selectedIndex! + 1} / {media.length}</div>
                            <div className="text-white/50 bg-black/40 px-3 py-1 rounded-full text-sm font-mono max-w-xs truncate" title={`${selectedItem.filename}${selectedItem.ext}`}>{selectedItem.filename}{selectedItem.ext}</div>
                        </div>
                        <div className="flex gap-1 items-center">
                            <TbBtn onClick={() => { isFlippedRef.current = !isFlippedRef.current; applyTransform(); }} title="Flip (H)"><FlipHorizontal size={18} /></TbBtn>
                            <TbBtn onClick={() => { rotationRef.current += 90; applyTransform(); }} title="Rotate (R)"><RotateCw size={18} /></TbBtn>
                            <div className="flex items-center bg-white/10 rounded-lg overflow-hidden border border-white/10">
                                <TbBtn onClick={toggleSlideshow} title="Slideshow">{isPlaying ? <Pause size={18} /> : <Play size={18} />}</TbBtn>
                                {isPlaying && <input type="number" className="w-10 bg-transparent text-white text-center text-sm p-1 border-l border-white/20 outline-none caret-transparent selection:bg-[var(--accent)]"
                                    value={isEditingInterval ? intervalEditValue : slideshowInterval}
                                    onFocus={e => { setIntervalEditValue(String(slideshowInterval)); setIsEditingInterval(true); requestAnimationFrame(() => e.target.select()); }}
                                    onChange={e => setIntervalEditValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = parseInt(intervalEditValue) || 10; setSlideshowInterval(v); localStorage.setItem('mg-slideshow-interval', v.toString()); setIsEditingInterval(false); (e.target as HTMLInputElement).blur(); } }}
                                    onBlur={() => { const v = parseInt(intervalEditValue) || 10; setSlideshowInterval(v); localStorage.setItem('mg-slideshow-interval', v.toString()); setIsEditingInterval(false); }}
                                    onClick={e => e.stopPropagation()}
                                />}
                            </div>
                            <TbBtn onClick={toggleFullscreen} title="Fullscreen (F)"><Maximize2 size={18} /></TbBtn>
                            <a href={getSourceLink(selectedItem)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                <TbBtn onClick={() => {}} title="View Source"><ExternalLink size={18} /></TbBtn>
                            </a>
                            <TbBtn onClick={handleSave} title="Download (S)"><Download size={18} /></TbBtn>
                            <TbBtn onClick={closeLightbox} title="Close (Esc)" isExit><X size={18} /></TbBtn>
                        </div>
                    </div>

                    {/* Post time */}
                    {selectedItem.tim > 0 && (
                        <div className="absolute top-12 left-3 z-50 transition-opacity duration-300" style={overlayFadeStyle} onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5 text-white/40 text-xs" title={formatExactTime(selectedItem.tim)}>
                                {SOURCE_FAVICONS[selectedItem.source] && <img src={SOURCE_FAVICONS[selectedItem.source]} alt="" className="w-3.5 h-3.5" style={{ imageRendering: 'auto' }} />}
                                <span>{formatRelativeTime(selectedItem.tim)}</span>
                            </div>
                        </div>
                    )}

                    {/* Main Content — media fills full viewport */}
                    <div ref={contentAreaRef} className="flex-1 flex items-center justify-center overflow-hidden relative">
                        {!mediaLoaded && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                <div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full w-2/5 bg-[var(--accent)] rounded-full animate-[shimmer_1s_ease-in-out_infinite]" />
                                </div>
                            </div>
                        )}

                        <NavArrow direction="prev" onClick={e => { e.stopPropagation(); setIsPlaying(false); handlePrev(); }} visible={overlayVisible} />

                        <div
                            ref={transformRef}
                            className="relative flex items-center justify-center"
                            style={{ cursor: 'grab', touchAction: 'none', transition: 'transform 0.1s ease-out' }}
                            onWheel={handleWheel}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onDoubleClick={handleDoubleClick}
                            onClick={e => e.stopPropagation()}
                        >
                            {VIDEO_EXTS.includes(selectedItem.ext) ? (
                                <div ref={videoWrapperRef} className="relative flex items-center justify-center">
                                    <div ref={mediaRotateRef} style={{ transition: 'transform 0.15s ease-out' }}>
                                        <video ref={videoRef} autoPlay loop={!isPlaying} className={`max-w-[90vw] max-h-[95vh] rounded shadow-2xl pointer-events-none transition-opacity duration-200 block ${mediaLoaded ? 'opacity-100' : 'opacity-0'}`} src={selectedVideoSrc}
                                            onLoadedData={() => setMediaLoaded(true)}
                                            onEnded={() => { if (isPlaying) { setSelectedIndex(prev => prev === null ? null : (prev + 1) % media.length); resetTransform(); } }}
                                            onLoadedMetadata={e => { const v = e.target as HTMLVideoElement; setDimensions({ width: v.videoWidth, height: v.videoHeight }); const sv = localStorage.getItem('mg-video-volume'); const sm = localStorage.getItem('mg-video-muted'); if (sv) v.volume = parseFloat(sv); if (sm) v.muted = sm === 'true'; }}
                                            onVolumeChange={e => { const v = e.target as HTMLVideoElement; localStorage.setItem('mg-video-volume', v.volume.toString()); localStorage.setItem('mg-video-muted', v.muted.toString()); setIsVideoMuted(v.muted); }}
                                            onPlay={() => setIsVideoPaused(false)}
                                            onPause={() => setIsVideoPaused(true)}
                                        />
                                    </div>
                                    {mediaLoaded && (
                                        <div
                                            className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-2 h-5 bg-black/60 backdrop-blur-sm rounded-b z-10"
                                            style={{ ...overlayFadeStyle, pointerEvents: overlayVisible ? 'auto' : 'none' }}
                                            onClick={e => e.stopPropagation()}
                                            onPointerDown={e => e.stopPropagation()}
                                            onPointerMove={e => e.stopPropagation()}
                                            onPointerUp={e => e.stopPropagation()}
                                            onWheel={e => e.stopPropagation()}
                                        >
                                            <button
                                                className="text-white/70 hover:text-white transition-colors duration-100 bg-transparent border-none cursor-pointer p-0.5"
                                                onClick={() => {
                                                    if (!videoRef.current) return;
                                                    if (isVideoPaused) {
                                                        void videoRef.current.play().catch(() => {});
                                                    } else {
                                                        videoRef.current.pause();
                                                    }
                                                }}
                                            >
                                                {isVideoPaused ? <Play size={12} /> : <Pause size={12} />}
                                            </button>
                                            <input
                                                type="range"
                                                className="video-seekbar flex-1"
                                                min={0}
                                                max={1}
                                                step={0.001}
                                                value={seekbarValue}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value);
                                                    setSeekbarValue(val);
                                                    if (videoRef.current && videoRef.current.duration) {
                                                        videoRef.current.currentTime = val * videoRef.current.duration;
                                                    }
                                                }}
                                                style={{ background: `linear-gradient(to right, var(--accent) ${seekbarValue * 100}%, rgba(255,255,255,0.12) ${seekbarValue * 100}%)` }}
                                            />
                                            <button
                                                className="text-white/70 hover:text-white transition-colors duration-100 bg-transparent border-none cursor-pointer p-0.5"
                                                onClick={() => { if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; } }}
                                            >
                                                {isVideoMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div ref={mediaRotateRef} style={{ transition: 'transform 0.15s ease-out' }}>
                                    <img ref={imgRef} src={proxyUrl(selectedItem.url)} alt={selectedItem.filename} fetchPriority="high" className={`max-w-[90vw] max-h-[95vh] rounded shadow-2xl object-contain transition-opacity duration-200 ${mediaLoaded ? 'opacity-100' : 'opacity-0'}`} draggable={false}
                                        onLoad={e => { const img = e.target as HTMLImageElement; setDimensions({ width: img.naturalWidth, height: img.naturalHeight }); setMediaLoaded(true); }}
                                    />
                                </div>
                            )}
                        </div>

                        <NavArrow direction="next" onClick={e => { e.stopPropagation(); setIsPlaying(false); handleNext(); }} visible={overlayVisible} />

                        {/* Playback speed overlay */}
                        {speedOverlay && (
                            <div key={speedOverlay.key} className="absolute top-16 right-6 z-20 pointer-events-none" style={{ animation: 'speedOverlay 3s ease forwards' }}>
                                <div className="bg-black/70 text-white/90 px-3 py-1 rounded-lg text-sm font-mono backdrop-blur-sm">
                                    {speedOverlay.text}
                                </div>
                            </div>
                        )}

                        {/* Media info overlay */}
                        <div className="absolute bottom-2 right-3 bg-black/70 px-2 py-0.5 rounded text-xs text-white/60 font-mono pointer-events-none z-10 transition-all duration-300" style={{ opacity: overlayVisible ? 1 : 0, transform: overlayVisible && thumbDocked ? 'translateY(-5.5rem)' : 'translateY(0)' }}>
                            {selectedItem.size ? `${formatSize(selectedItem.size)} | ` : ''}{dimensions ? `${dimensions.width}x${dimensions.height}` : '...'}
                        </div>
                    </div>

                    {/* Dock toggle — full-width strip, always visible at bottom */}
                    <button
                        className="group/dock absolute bottom-0 left-0 right-0 z-50 h-1.5 flex items-center justify-center bg-[#141418] hover:bg-[#1e1e1e] cursor-pointer transition-all duration-300 ease-in-out"
                        style={{ transform: thumbDocked ? 'translateY(-5rem)' : 'translateY(0)', opacity: overlayVisible ? 1 : 0, pointerEvents: overlayVisible ? 'auto' : 'none' }}
                        onClick={e => { e.stopPropagation(); toggleThumbDocked(); }}
                        title={thumbDocked ? 'Hide thumbnails (T)' : 'Show thumbnails (T)'}
                    >
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#141418] group-hover/dock:bg-[#1e1e1e] px-2.5 py-0.5 rounded-t text-white/50 group-hover/dock:text-white/80 transition-colors duration-150">
                            {thumbDocked ? <ChevronDown size={16} strokeWidth={3.5} /> : <ChevronUp size={16} strokeWidth={3.5} />}
                        </span>
                    </button>

                    {/* Keyboard shortcuts flyout */}
                    <div
                        className="group/kb absolute bottom-2 left-3 z-50"
                        style={{ transform: thumbDocked ? 'translateY(-5.5rem)' : 'translateY(0)', transition: 'transform 0.3s ease-in-out, opacity 0.3s ease', opacity: overlayVisible ? 1 : 0, pointerEvents: overlayVisible ? 'auto' : 'none' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white/40 text-xs font-bold cursor-default select-none group-hover/kb:bg-white/15 group-hover/kb:text-white/60 transition-all duration-150">K</div>
                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover/kb:block">
                            <div className="bg-black/85 backdrop-blur-md rounded-xl border border-white/10 px-4 py-3 text-xs text-white/70 whitespace-nowrap shadow-2xl animate-[fadeIn_0.15s_ease-out]">
                                <div className="text-white/40 font-semibold uppercase tracking-wider text-[10px] mb-2">Shortcuts</div>
                                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                                    <kbd className="text-white/50 font-mono">← →</kbd><span>Previous / Next</span>
                                    <kbd className="text-white/50 font-mono">Space</kbd><span>Slideshow</span>
                                    <kbd className="text-white/50 font-mono">F</kbd><span>Fullscreen</span>
                                    <kbd className="text-white/50 font-mono">H</kbd><span>Flip</span>
                                    <kbd className="text-white/50 font-mono">R</kbd><span>Rotate</span>
                                    <kbd className="text-white/50 font-mono">S</kbd><span>Download</span>
                                    <kbd className="text-white/50 font-mono">T</kbd><span>Thumbnails</span>
                                    <kbd className="text-white/50 font-mono">M</kbd><span>Mute</span>
                                    <kbd className="text-white/50 font-mono">&lt; &gt;</kbd><span>Frame step</span>
                                    <kbd className="text-white/50 font-mono">[ ]</kbd><span>Playback speed</span>
                                    <kbd className="text-white/50 font-mono">\</kbd><span>Reset speed</span>
                                    <kbd className="text-white/50 font-mono">Scroll</kbd><span>Zoom</span>
                                    <kbd className="text-white/50 font-mono">Esc</kbd><span>Close</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Thumbnail Strip — absolutely positioned, slides up/down */}
                    <div
                        className="absolute bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out"
                        style={{ transform: thumbDocked ? 'translateY(0)' : 'translateY(100%)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div ref={thumbnailStripRef} className="h-20 bg-black flex items-center gap-1.5 px-3 overflow-x-auto" style={overlayFadeStyle}>
                            {media.map((item, index) => (
                                    <button key={`thumb-${index}`} onClick={() => { setSelectedIndex(index); setIsPlaying(false); resetTransform(); }}
                                        className={`relative h-16 w-16 shrink-0 rounded overflow-hidden border-2 transition-all duration-100 cursor-pointer ${index === selectedIndex ? 'border-[var(--accent)] opacity-100' : 'border-transparent opacity-40 hover:opacity-80'}`}
                                    >
                                        <LazyThumb src={proxyUrl(item.thumbnail)} alt="" className="object-cover w-full h-full" />
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>,
                portalTarget
            )}
        </>
    );
}

function NavArrow({ direction, onClick, visible = true }: { direction: 'prev' | 'next'; onClick: (e: MouseEvent) => void; visible?: boolean }) {
    const isPrev = direction === 'prev';
    return (
        <button
            className={`absolute ${isPrev ? 'left-0' : 'right-0'} top-1/2 -translate-y-1/2 z-50 p-0 cursor-pointer outline-none bg-transparent border-none transition-all duration-300 ${visible ? 'opacity-70 hover:opacity-100 hover:scale-105 active:scale-95' : 'opacity-0 pointer-events-none'}`}
            style={{ transformOrigin: isPrev ? 'left center' : 'right center' }}
            onClick={onClick}
        >
            <img src={isPrev ? BASE64_PREV : BASE64_NEXT} className="w-16 h-auto drop-shadow-lg" alt={isPrev ? 'Previous' : 'Next'} draggable={false} />
        </button>
    );
}

function TbBtn({ onClick, children, title, isExit = false }: { onClick: () => void; children: React.ReactNode; title: string; isExit?: boolean }) {
    return (
        <button
            onClick={onClick}
            className={`p-2 outline-none cursor-pointer bg-transparent border-none transition-all duration-100 hover:scale-110 active:scale-90 ${isExit ? 'text-white/70 hover:text-red-400' : 'text-white/70 hover:text-[#E445FF]'}`}
            title={title}
        >
            {children}
        </button>
    );
}
