import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The home-server image runs Next's self-contained production server.
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "header",
            key: "host",
            value: "k-football-radar\\.vercel\\.app"
          }
        ],
        destination: "https://k-football-radar.app/:path*",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
