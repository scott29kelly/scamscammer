import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Twilio webhook requests
  async headers() {
    return [
      {
        source: "/api/twilio/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, X-Twilio-Signature" },
        ],
      },
    ];
  },
};

export default nextConfig;
