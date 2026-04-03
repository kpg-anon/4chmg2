import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');
const MAX_BODY_BYTES = 64 * 1024; // 64 KB
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // requests per window per IP

// In-memory sliding-window rate limiter: IP → timestamps of recent requests.
// This resets on process restart (acceptable for a local log endpoint).
const rateLimitStore = new Map<string, number[]>();

function getClientIp(request: NextRequest): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
}

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const timestamps = (rateLimitStore.get(ip) ?? []).filter(t => t > windowStart);
    if (timestamps.length >= RATE_LIMIT_MAX) return true;
    timestamps.push(now);
    rateLimitStore.set(ip, timestamps);
    return false;
}

export async function POST(request: NextRequest) {
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
        return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Reject oversized payloads before reading the body
    const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
        return NextResponse.json({ success: false, error: 'Payload too large' }, { status: 413 });
    }

    try {
        const raw = await request.arrayBuffer();
        if (raw.byteLength > MAX_BODY_BYTES) {
            return NextResponse.json({ success: false, error: 'Payload too large' }, { status: 413 });
        }

        const body: unknown = JSON.parse(Buffer.from(raw).toString('utf8'));
        const entries = Array.isArray(body) ? body : [body];

        await fs.promises.mkdir(LOGS_DIR, { recursive: true });

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const filepath = path.join(LOGS_DIR, `app-${dateStr}.log`);

        const logEntries = entries.map((entry: unknown) => {
            const e = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
            const timestamp = now.toISOString();
            const level = typeof e.level === 'string' ? e.level.toUpperCase() : 'INFO';
            const message = typeof e.message === 'string' ? e.message : '';
            const data = e.data != null ? ' ' + JSON.stringify(e.data) : '';
            return `[${timestamp}] [${level}] ${message}${data}`;
        }).join('\n') + '\n';

        await fs.promises.appendFile(filepath, logEntries, 'utf8');

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Logging error:', msg);
        return NextResponse.json({ success: false, error: 'Failed to write log' }, { status: 500 });
    }
}

export async function GET() {
    try {
        await fs.promises.mkdir(LOGS_DIR, { recursive: true });
        const names = await fs.promises.readdir(LOGS_DIR);
        const files = await Promise.all(
            names
                .filter(f => f.endsWith('.log'))
                .map(async f => {
                    const stat = await fs.promises.stat(path.join(LOGS_DIR, f));
                    return { name: f, size: stat.size, modified: stat.mtime };
                })
        );
        return NextResponse.json({ files });
    } catch {
        return NextResponse.json({ error: 'Failed to list logs' }, { status: 500 });
    }
}
