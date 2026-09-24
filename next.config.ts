import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Share cards read their fonts and backgrounds from disk (lib/og.tsx).
  outputFileTracingIncludes: {
    "/**/opengraph-image*": ["./assets/fonts/*.ttf", "./assets/og/*.jpg"],
  },
};

export default nextConfig;
