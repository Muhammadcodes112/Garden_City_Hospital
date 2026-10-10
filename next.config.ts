import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // Step 16: lets src/lib/authz.ts throw a real 403/401 from Server
  // Components, Server Actions, AND Route Handlers via the same two
  // functions (forbidden()/unauthorized() from next/navigation), instead of
  // a parallel redirect-for-pages / return-null-for-APIs split.
  experimental: {
    authInterrupts: true,
  },
  async redirects() {
    return [
      { source: "/lab-form", destination: "/lab", permanent: true },
      { source: "/lab-form/:path*", destination: "/lab/:path*", permanent: true },
      { source: "/admins", destination: "/users", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Vercel terminates TLS for every deployment, so HSTS is always
          // safe to send — browsers only honor it over https anyway.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Silent unless authToken is set (e.g. in CI) — source maps just won't
  // upload locally, which is fine; release tagging still works at runtime.
  silent: !process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
});
