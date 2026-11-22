import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeScript type-checking is run separately via `tsc --noEmit --skipLibCheck`
  // to avoid OOM crashes in memory-constrained environments (the TS language
  // server requires >4 GB heap for large node_modules type graphs).
  typescript: { ignoreBuildErrors: true },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
