import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
    // ⚠️ FIXME: PPR requires Next.js canary. Re-enable after upgrading from 15.5.9 stable
    // experimental: {
    //   ppr: true,
    // },
    turbopack: { root: __dirname },
    images: {
        remotePatterns: [
            {
                hostname: "avatar.vercel.sh",
            },
        ],
    },
};

export default nextConfig;
