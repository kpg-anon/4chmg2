import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
