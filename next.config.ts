import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone-сборка нужна для VPS (bun .next/standalone/server.js);
  // на Vercel используется собственный рантайм — standalone там не нужен
  output: process.env.VERCEL ? undefined : "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
