import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "This week" became the default view of What's new (Oct 2026).
  async redirects() {
    return [{ source: "/this-week", destination: "/whats-new", permanent: true }];
  },
  // Share cards read their fonts and backgrounds from disk (lib/og.tsx).
  outputFileTracingIncludes: {
    "/**/opengraph-image*": ["./assets/fonts/*.ttf", "./assets/og/*.jpg"],
  },
};

export default nextConfig;
