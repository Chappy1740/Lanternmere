import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
