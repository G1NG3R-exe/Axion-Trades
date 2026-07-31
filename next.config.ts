import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    if (!process.env.VERCEL) return [];
    const backend = process.env.SIGNAL_FORGE_BACKEND_URL ??
      "https://signal-forge-aapl-lab.alexshmulevich424.chatgpt.site";
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${backend}/api/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
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
