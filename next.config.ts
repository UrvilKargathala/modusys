import type { NextConfig } from "next";

// UniFi Access controller uses a self-signed certificate
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
