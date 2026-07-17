import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The home-server image runs Next's self-contained production server.
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**"
      }
    ]
  },
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
