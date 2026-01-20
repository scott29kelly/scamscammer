import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure headers for Twilio webhooks
  async headers() {
    return [
      {
        // Allow Twilio webhook requests
        source: "/api/twilio/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, X-Twilio-Signature",
          },
        ],
      },
    ];
  },

  // Image optimization configuration
  images: {
    remotePatterns: [
      // Add remote image patterns as needed
    ],
  },

  // Logging configuration
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
