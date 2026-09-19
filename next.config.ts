import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  agentRules: false,
  async redirects() {
    return [
      { source: "/lab-form", destination: "/lab", permanent: true },
      { source: "/lab-form/:path*", destination: "/lab/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
