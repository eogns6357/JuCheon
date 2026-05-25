import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "imgnews.pstatic.net",
        pathname: "/image/**",
      },
    ],
  },
};

export default nextConfig;
