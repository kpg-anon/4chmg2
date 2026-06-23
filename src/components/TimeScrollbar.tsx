'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatRelativeTime } from '@/lib/time';

// Custom right-edge scrollbar that scrubs the window scroll and surfaces the
// relative post-time of whatever tile sits at the viewport centre. The gallery
// grid is sorted oldest -> newest top-to-bottom, so dragging down walks forward
// in time. Reads timestamps straight off the `data-tim` attribute on grid tiles
// (set in Gallery.tsx), so it stays decoupled from the media array.

const RAIL_PAD = 8;          // px gap at top/bottom of the track
const MIN_THUMB = 36;        // px — keep the thumb grabbable on huge result sets
const IDLE_HIDE_MS = 1200;   // fade out this long after the last interaction
const SCROLLABLE_SLOP = 40;  // px of overflow before the rail is worth showing
const HOVER_ZONE_PX = 80;    // right-edge band that reveals the rail on mouseover

interface Metrics {
    maxScroll: number;
    trackHeight: number;
    thumbHeight: number;
}

export default function TimeScrollbar() {
    const [scrollable, setScrollable] = useState(false);
    const [visible, setVisible] = useState(false);
    const [thumbTop, setThumbTop] = useState(RAIL_PAD);
    const [thumbHeight, setThumbHeight] = useState(MIN_THUMB);
    const [label, setLabel] = useState('');

    const metricsRef = useRef<Metrics>({ maxScroll: 0, trackHeight: 0, thumbHeight: MIN_THUMB });
    const rafRef = useRef<number | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const draggingRef = useRef(false);
    const hoveringRef = useRef(false);
    const dragOffsetRef = useRef(0);

    // Resolve the relative time of the tile under the viewport centre.
    const updateLabel = useCallback(() => {
        const cx = Math.round(window.innerWidth / 2);
        const cy = Math.round(window.innerHeight / 2);
        // Centre may land in a grid gap; probe a few vertical offsets.
        for (const dy of [0, -48, 48, -96, 96]) {
            const el = document.elementFromPoint(cx, cy + dy) as HTMLElement | null;
            const tile = el?.closest('[data-tim]') as HTMLElement | null;
            if (tile) {
                const tim = Number(tile.dataset.tim);
                if (tim > 0) setLabel(formatRelativeTime(tim));
                return;
            }
        }
    }, []);

    const measure = useCallback(() => {
        const doc = document.documentElement;
        const clientHeight = window.innerHeight;
        const scrollHeight = doc.scrollHeight;
        const maxScroll = scrollHeight - clientHeight;
        const isScrollable = maxScroll > SCROLLABLE_SLOP;
        setScrollable(isScrollable);
        if (!isScrollable) return;

        const trackHeight = clientHeight - RAIL_PAD * 2;
        const th = Math.max(MIN_THUMB, Math.min(trackHeight, trackHeight * (clientHeight / scrollHeight)));
        const frac = maxScroll > 0 ? window.scrollY / maxScroll : 0;
        const top = RAIL_PAD + frac * (trackHeight - th);

        metricsRef.current = { maxScroll, trackHeight, thumbHeight: th };
        setThumbHeight(th);
        setThumbTop(top);
    }, []);

    const show = useCallback(() => {
        setVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        if (!draggingRef.current && !hoveringRef.current) {
            hideTimerRef.current = setTimeout(() => setVisible(false), IDLE_HIDE_MS);
        }
    }, []);

    // rAF-throttled response to scroll.
    useEffect(() => {
        const onScroll = () => {
            if (rafRef.current !== null) return;
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                measure();
                updateLabel();
                show();
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [measure, updateLabel, show]);

    // Reveal on mouseover near the right edge (where the rail lives). Passive +
    // window-level so it never blocks clicks; shows the current active-position
    // time without requiring a scroll. Work happens only on entering the zone.
    useEffect(() => {
        const onPointerMove = (e: PointerEvent) => {
            const inZone = e.clientX >= window.innerWidth - HOVER_ZONE_PX;
            if (inZone) {
                if (!hoveringRef.current) {
                    hoveringRef.current = true;
                    measure();
                    updateLabel();
                }
                if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                setVisible(true);
            } else if (hoveringRef.current) {
                hoveringRef.current = false;
                if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                hideTimerRef.current = setTimeout(() => setVisible(false), IDLE_HIDE_MS);
            }
        };
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        return () => window.removeEventListener('pointermove', onPointerMove);
    }, [measure, updateLabel]);

    // Re-measure on viewport resize and on content growth (media loads in).
    useEffect(() => {
        measure();
        const onResize = () => { measure(); updateLabel(); };
        window.addEventListener('resize', onResize);
        const ro = new ResizeObserver(() => measure());
        ro.observe(document.body);
        return () => { window.removeEventListener('resize', onResize); ro.disconnect(); };
    }, [measure, updateLabel]);

    // Prime the label once tiles exist.
    useEffect(() => {
        const id = requestAnimationFrame(updateLabel);
        return () => cancelAnimationFrame(id);
    }, [updateLabel]);

    // Keep the relative-time label fresh on long idle sessions — "2m ago" would
    // otherwise stay frozen at whatever it read on the last scroll/hover.
    useEffect(() => {
        const id = setInterval(updateLabel, 30000);
        return () => clearInterval(id);
    }, [updateLabel]);

    // Hide the native scrollbar only while this rail is mounted + active.
    useEffect(() => {
        if (!scrollable) return;
        const root = document.documentElement;
        root.classList.add('mg-hide-native-scroll');
        return () => root.classList.remove('mg-hide-native-scroll');
    }, [scrollable]);

    const scrollToClientY = useCallback((clientY: number, offset: number) => {
        const { maxScroll, trackHeight, thumbHeight: th } = metricsRef.current;
        const range = trackHeight - th;
        if (range <= 0) return;
        const top = Math.max(RAIL_PAD, Math.min(RAIL_PAD + range, clientY - offset));
        const frac = (top - RAIL_PAD) / range;
        window.scrollTo(0, frac * maxScroll);
    }, []);

    const onThumbPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        draggingRef.current = true;
        dragOffsetRef.current = e.clientY - thumbTop;
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setVisible(true);

        const onMove = (ev: PointerEvent) => scrollToClientY(ev.clientY, dragOffsetRef.current);
        const onUp = () => {
            draggingRef.current = false;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            show();
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }, [thumbTop, scrollToClientY, show]);

    // Click anywhere on the track: jump so the thumb centres on the cursor,
    // then continue as a drag.
    const onTrackPointerDown = useCallback((e: React.PointerEvent) => {
        const { thumbHeight: th } = metricsRef.current;
        dragOffsetRef.current = th / 2;
        scrollToClientY(e.clientY, th / 2);
        draggingRef.current = true;
        setVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

        const onMove = (ev: PointerEvent) => scrollToClientY(ev.clientY, dragOffsetRef.current);
        const onUp = () => {
            draggingRef.current = false;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            show();
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }, [scrollToClientY, show]);

    useEffect(() => () => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    }, []);

    if (!scrollable) return null;

    const thumbCenter = thumbTop + thumbHeight / 2;

    return (
        <div
            className="fixed inset-y-0 right-0 z-30 w-4 select-none transition-opacity duration-300"
            style={{ opacity: visible ? 1 : 0 }}
            onPointerDown={onTrackPointerDown}
            aria-hidden="true"
        >
            {/* Track line */}
            <div className="absolute inset-y-2 right-[6px] w-px bg-[var(--border)]" />

            {/* Time bubble — sits to the left of the thumb */}
            {label && (
                <div
                    className="absolute right-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-secondary)] shadow-lg pointer-events-none"
                    style={{ top: thumbCenter }}
                >
                    {label}
                </div>
            )}

            {/* Thumb */}
            <div
                className="absolute right-[3px] w-2.5 rounded-full bg-[color:color-mix(in_srgb,var(--accent)_55%,var(--border))] hover:bg-[var(--accent)] cursor-grab active:cursor-grabbing transition-colors"
                style={{ top: thumbTop, height: thumbHeight }}
                onPointerDown={onThumbPointerDown}
            />
        </div>
    );
}
