import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// The repo root holds web/, backend/, shared/ and mobile/. The website is built
// from here, but the one .env.local file lives at the repo root. Next.js has
// already loaded env files from web/ (there are none) and caches that, so
// force a reload from the root. Real environment variables (Coolify) always win.
const repoRoot = path.resolve(__dirname, "..");
loadEnvConfig(repoRoot, process.env.NODE_ENV !== "production", console, true);

// UniFi Access controller uses a self-signed certificate
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const nextConfig: NextConfig = {
  // backend/ and shared/ sit next to web/, so build from the repo root.
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
