import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
