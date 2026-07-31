import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    if (!process.env.VERCEL) return [];
    return [
      {
        source: "/:path*",
        destination: "https://signal-forge-aapl-lab.alexshmulevich424.chatgpt.site/:path*",
        permanent: false,
      },
    ];
  },
  typescript: {
    tsconfigPath: process.env.VERCEL ? "tsconfig.vercel.json" : "tsconfig.json",
  },
  turbopack: {
    root: process.cwd(),
    resolveAlias: process.env.VERCEL
      ? {
          "cloudflare:workers": "./db/cloudflare-workers-vercel.ts",
        }
      : {},
  },
};

export default nextConfig;
