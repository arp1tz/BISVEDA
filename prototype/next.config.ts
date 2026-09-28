import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hides the Next.js "N" dev-mode badge.
  devIndicators: false,
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: "/api/v8/:path*",
          destination: "http://127.0.0.1:8000/api/v8/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
