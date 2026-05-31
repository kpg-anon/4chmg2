import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Single source of truth for the app version: package.json. Exposed to the
// client as NEXT_PUBLIC_APP_VERSION so the About modal tracks it automatically.
const { version } = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
) as { version: string };

const nextConfig: NextConfig = {
    env: {
        NEXT_PUBLIC_APP_VERSION: version,
    },
    experimental: {
        cpus: 4,
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'i.4cdn.org' },
            { protocol: 'https', hostname: 'is2.4chan.org' },
            { protocol: 'https', hostname: 'easychan.net' },
            { protocol: 'https', hostname: 'mokachan.cafe' },
            { protocol: 'https', hostname: '2ch.org' },
        ],
    },
    allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
        ? process.env.ALLOWED_DEV_ORIGINS.split(',').map(s => s.trim())
        : [],
};

export default nextConfig;
