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
          { key: 'Referrer-Policy', value: 'no-referrer' },
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
