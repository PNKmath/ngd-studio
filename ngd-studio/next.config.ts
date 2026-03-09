import type { NextConfig } from "next";

const SSE_PORT = process.env.SSE_PORT ?? "3021";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/run",
        destination: `http://localhost:${SSE_PORT}/api/run`,
      },
    ];
  },
};

export default nextConfig;
