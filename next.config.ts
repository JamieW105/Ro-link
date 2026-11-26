import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the development badge from covering the sidebar account controls.
  devIndicators: false,
  reactCompiler: true,
};

export default nextConfig;
