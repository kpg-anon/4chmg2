'use client';

// Client-side logger that sends logs to server
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    data?: unknown;
}

const LOG_BUFFER: LogEntry[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

const flushLogs = async () => {
    if (LOG_BUFFER.length === 0) return;

    const entriesToSend = [...LOG_BUFFER];
    LOG_BUFFER.length = 0;

    try {
        await fetch('/api/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entriesToSend),
            keepalive: true,
        });
    } catch (error) {
        // Fallback to console if API fails
        console.error('Failed to send logs to server:', error);
    }
};

export const logger = {
    debug(message: string, data?: unknown) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'debug',
            message,
            data,
        };
        console.debug(`[DEBUG] ${message}`, data ?? '');
        LOG_BUFFER.push(entry);
        scheduleFlush();
    },

    info(message: string, data?: unknown) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'info',
            message,
            data,
        };
        console.info(`[INFO] ${message}`, data ?? '');
        LOG_BUFFER.push(entry);
        scheduleFlush();
    },

    warn(message: string, data?: unknown) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'warn',
            message,
            data,
        };
        console.warn(`[WARN] ${message}`, data ?? '');
        LOG_BUFFER.push(entry);
        scheduleFlush();
    },

    error(message: string, data?: unknown) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'error',
            message,
            data,
        };
        console.error(`[ERROR] ${message}`, data ?? '');
        LOG_BUFFER.push(entry);
        scheduleFlush();
    },

    // Force flush all pending logs
    flush() {
        flushLogs();
    },
};

function scheduleFlush() {
    if (flushTimeout) return;
    flushTimeout = setTimeout(() => {
        flushTimeout = null;
        flushLogs();
    }, 1000); // Flush after 1 second of inactivity
}

// Flush on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => flushLogs());
}

export default logger;
