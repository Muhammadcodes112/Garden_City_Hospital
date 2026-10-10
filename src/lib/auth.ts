import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, twoFactor } from "better-auth/plugins";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  // Structural only: no email provider is wired up (sendVerificationEmail
  // just logs), so this is NOT globally enforced on sign-in — doing that
  // with no real delivery would permanently lock every patient out. It
  // exists so a future patient-facing action (e.g. booking) can call
  // auth.api.sendVerificationEmail() and check session.user.emailVerified
  // before allowing it, per Step 16 D's "before the account can book
  // anything". Wire a real provider (Resend/SMTP) before relying on this.
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`[email-verification] (no provider configured) ${user.email}: ${url}`);
    },
    autoSignInAfterVerification: true,
  },
  user: {
    additionalFields: {
      phone: { type: "string", required: false, input: true },
    },
  },
  // Lets middleware (Edge runtime, no DB access) read `role` off a signed
  // cookie for redirect UX only — e.g. sending a patient away from /dashboard
  // to their own area. It is NOT the authorization boundary: every
  // server action, API route, and layout re-validates against the live
  // session via requireUser()/requireStaff()/requireSuperAdmin()
  // (src/lib/authz.ts), so a stale cache entry (up to 60s) can only ever
  // misdirect a redirect, never grant access.
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
  plugins: [
    admin({
      defaultRole: "patient",
      adminRole: "super_admin",
    }),
    twoFactor(),
  ],
  trustedOrigins: [
    "https://gardencityhospital.vercel.app",
    "https://garden-city.vercel.app",
    "https://Garden-City.vercel.app",
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    ...(process.env.NEXT_PUBLIC_BETTER_AUTH_URL ? [process.env.NEXT_PUBLIC_BETTER_AUTH_URL] : []),
  ],
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 20,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
