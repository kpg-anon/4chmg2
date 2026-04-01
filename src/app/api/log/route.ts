import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        // Handle both single entry and array of entries
        const entries = Array.isArray(body) ? body : [body];
        
        // Ensure logs directory exists
        if (!fs.existsSync(LOGS_DIR)) {
            fs.mkdirSync(LOGS_DIR, { recursive: true });
        }

        // Create filename with current date
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const filename = `app-${dateStr}.log`;
        const filepath = path.join(LOGS_DIR, filename);

        // Format and write all entries
        const logEntries = entries.map((entry: { level?: string; message?: string; data?: unknown }) => {
            const timestamp = now.toISOString();
            const level = entry.level?.toUpperCase() || 'INFO';
            const message = entry.message || '';
            const data = entry.data ? ' ' + JSON.stringify(entry.data) : '';
            return `[${timestamp}] [${level}] ${message}${data}`;
        }).join('\n') + '\n';

        fs.appendFileSync(filepath, logEntries);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logging error:', error);
        return NextResponse.json({ success: false, error: 'Failed to write log' }, { status: 500 });
    }
}

export async function GET() {
    try {
        if (!fs.existsSync(LOGS_DIR)) {
            return NextResponse.json({ files: [] });
        }
        const files = fs.readdirSync(LOGS_DIR)
            .filter(f => f.endsWith('.log'))
            .map(f => ({
                name: f,
                size: fs.statSync(path.join(LOGS_DIR, f)).size,
                modified: fs.statSync(path.join(LOGS_DIR, f)).mtime
            }));
        return NextResponse.json({ files });
    } catch {
        return NextResponse.json({ error: 'Failed to list logs' }, { status: 500 });
    }
}
