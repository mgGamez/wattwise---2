import type { NextConfig } from "next";

// Static export: the site is plain HTML/CSS/JS in ./out — no server, no API.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // /analyze/index.html etc. — works on any static file server, including after refresh.
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
