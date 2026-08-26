import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  agentRules: false,
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  outputFileTracingIncludes: {
    "/*": ["../_data/*.json", "../vault/**/*.md"],
  },
  reactStrictMode: true,
};

export default nextConfig;
