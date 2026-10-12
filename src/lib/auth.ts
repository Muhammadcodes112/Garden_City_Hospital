import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, twoFactor } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import { db } from "@/db";
import { logEvent, clientIpFrom, type ActorRole } from "@/lib/activity";

/**
 * Step 17 B (auth category): one after-hook, matched by path, covering
 * every auth lifecycle event better-auth doesn't give us a dedicated
 * callback for. ctx.context.returned is the endpoint's response body —
 * used to tell success from failure (e.g. a failed sign-in still reaches
 * this hook, just with an error shape instead of a session).
 */
const activityAuthHook = createAuthMiddleware(async (ctx) => {
  const path = ctx.path;
  const ip = clientIpFrom(ctx.headers ?? new Headers());
  const userAgent = ctx.headers?.get("user-agent") ?? null;
  const returned = ctx.context.returned as Record<string, unknown> | undefined;
  const isError = Boolean(returned && typeof returned === "object" && "status" in (returned as any) && (returned as any).status && (returned as any).status >= 400);

  const sessionUser = (ctx.context.newSession as { user?: { id: string; name: string; role?: ActorRole } } | undefined)?.user;

  async function log(action: string, summary: string, opts: { actorFromSession?: boolean; metadata?: Record<string, unknown> } = {}) {
    const actor = opts.actorFromSession ? sessionUser : undefined;
    await logEvent({
      category: "auth",
      action,
      summary,
      actorId: actor?.id ?? null,
      actorRoleAtTime: (actor?.role as ActorRole) ?? null,
      actorLabel: actor?.name ?? null,
      ipAddress: ip,
      userAgent,
      metadata: opts.metadata,
    });
  }

  if (path.startsWith("/sign-up/email") && !isError) {
    await log("registered", `${sessionUser?.name ?? "New account"} registered`, { actorFromSession: true });
  } else if (path.startsWith("/sign-in/email")) {
    if (isError) {
      const attemptedEmail = typeof ctx.body?.email === "string" ? ctx.body.email : "unknown";
      await log("signin.failed", `Failed sign-in attempt for ${attemptedEmail}`, {
        metadata: { attemptedEmail },
      });
    } else {
      await log("signin", `${sessionUser?.name ?? "Account"} signed in`, { actorFromSession: true });
    }
  } else if (path.startsWith("/sign-out") && !isError) {
    // No session on the response for sign-out; the session cookie being
    // cleared is already gone by the time `after` runs, so identify the
    // actor from the request's own (still-valid-at-request-time) session.
    const requestSession = ctx.context.session?.user as { id: string; name: string; role?: ActorRole } | undefined;
    await logEvent({
      category: "auth",
      action: "signedout",
      summary: `${requestSession?.name ?? "Account"} signed out`,
      actorId: requestSession?.id ?? null,
      actorRoleAtTime: (requestSession?.role as ActorRole) ?? null,
      actorLabel: requestSession?.name ?? null,
      ipAddress: ip,
      userAgent,
    });
  } else if (path.startsWith("/verify-email") && !isError) {
    await log("email_verified", `${sessionUser?.name ?? "Account"} verified their email`, { actorFromSession: true });
  } else if (path.startsWith("/change-password") && !isError) {
    await log("password_changed", `${sessionUser?.name ?? "Account"} changed their password`, { actorFromSession: true });
  } else if (path.startsWith("/request-password-reset") && !isError) {
    const requestedEmail = typeof ctx.body?.email === "string" ? ctx.body.email : "unknown";
    await log("password_reset_requested", `Password reset requested for ${requestedEmail}`, {
      metadata: { requestedEmail },
    });
  } else if (path.startsWith("/two-factor/enable") && !isError) {
    await log("2fa_enabled", `${sessionUser?.name ?? "Account"} enabled two-factor authentication`, { actorFromSession: true });
  } else if (path.startsWith("/two-factor/disable") && !isError) {
    await log("2fa_disabled", `${sessionUser?.name ?? "Account"} disabled two-factor authentication`, { actorFromSession: true });
  } else if ((path.startsWith("/revoke-session") || path.startsWith("/revoke-sessions")) && !isError) {
    await log("session_revoked", `${sessionUser?.name ?? "Account"} revoked a session`, { actorFromSession: true });
  }
});

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
  hooks: {
    after: activityAuthHook,
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
