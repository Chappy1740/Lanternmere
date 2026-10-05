import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          // Native form POSTs need a real Origin for Server Action CSRF checks.
          // Keep referrers within Lanternmere and omit them on external requests.
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'render.worldofwarcraft.com',
        port: '',
        pathname: '/*/character/**',
        search: '',
      },
      ...['us', 'eu', 'kr', 'tw'].map((region) => ({
        protocol: 'https' as const,
        hostname: `render-${region}.worldofwarcraft.com`,
        port: '',
        pathname: '/character/**',
        search: '',
      })),
    ],
    maximumRedirects: 0,
  },
};

export default nextConfig;
