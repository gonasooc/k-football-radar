import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The home-server image runs Next's self-contained production server.
  output: "standalone"
};

export default nextConfig;
