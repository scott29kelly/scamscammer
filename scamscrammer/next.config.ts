import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Strict mode for better development experience
  reactStrictMode: true,

  // Enable experimental features for real-time voice streaming
  experimental: {
    // Server actions for form handling
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Configure allowed image domains (if needed for avatars, etc.)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.twilio.com',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
    ],
  },

  // Headers for security and CORS
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        // CORS headers for Twilio webhook endpoints
        source: '/api/twilio/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'POST, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, X-Twilio-Signature',
          },
        ],
      },
    ];
  },

  // Redirects (if needed)
  async redirects() {
    return [];
  },

  // Rewrites for webhook routing (if needed)
  async rewrites() {
    return [];
  },

  // Logging configuration
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // TypeScript configuration
  typescript: {
    // Allow production builds even with type errors (not recommended, but useful for CI)
    // ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    // Allow production builds even with ESLint errors (not recommended for production)
    // ignoreDuringBuilds: false,
  },

  // Output configuration for Vercel
  output: 'standalone',

  // Environment variables that should be available on the client
  // Note: NEXT_PUBLIC_ prefixed vars are automatically exposed
  env: {
    // Add any non-sensitive server-side env vars here if needed
  },

  // Webpack configuration for external packages
  webpack: (config, { isServer }) => {
    // Handle packages that need special treatment
    if (isServer) {
      // Mark packages that should not be bundled
      config.externals = config.externals || [];
    }
    return config;
  },
};

export default nextConfig;
