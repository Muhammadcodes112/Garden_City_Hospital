import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie, getCookieCache } from "better-auth/cookies";

const AUTH_PAGES = ["/sign-in", "/sign-up"];
const STAFF_PAGES = [
  "/dashboard",
  "/appointments",
  "/messages",
  "/documents",
  "/doctors-workstation",
  "/lab",
  "/prescription",
  "/medical-report",
  "/patients",
  "/records",
  "/inventory",
  "/users",
  "/activity",
];
const PATIENT_PAGES = ["/patient"];
const PROTECTED_PAGES = [...STAFF_PAGES, ...PATIENT_PAGES];

// The Sentry browser SDK reports events via fetch() to its DSN's own host —
// a plain 'self' connect-src would silently block every report once a real
// DSN is set. The DSN embeds that host directly (https://KEY@HOST/PROJECT),
// so this reads it straight from the public env var rather than guessing at
// Sentry's ingest domain patterns.
function sentryConnectSrc(): string {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return "";
  try {
    return ` https://${new URL(dsn).host}`;
  } catch {
    return "";
  }
}

function buildCsp(): string {
  // No nonce here on purpose: this route group includes statically
  // prerendered/cached pages (e.g. /sign-in), and Next.js nonces only work
  // with dynamic rendering — a cached page's inline hydration scripts
  // (self.__next_f.push(...)) get baked in with no nonce attribute, while
  // a nonce source in this header still makes browsers ignore
  // 'unsafe-inline' for ALL inline scripts (CSP spec: 'unsafe-inline' is
  // ignored once a nonce/hash is present), blocking hydration entirely and
  // breaking client-side form submission. Nothing in this app reads the
  // nonce to tag its own inline scripts, so there's no benefit to keeping
  // it — only the breakage. See node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
  //
  // style-src keeps 'unsafe-inline': Radix UI sets inline `style="..."`
  // attributes for popover/dialog positioning. Inline style injection can't
  // execute script, so this is a narrower risk than 'unsafe-inline' on
  // script-src would be.
  //
  // img-src allows data:/blob: for the signature pad's canvas export and
  // client-side image blob handling.
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${sentryConnectSrc()}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

// Lightweight check: cookie presence for auth, and the signed cookie-cache
// copy of `role` (src/lib/auth.ts session.cookieCache) for redirect UX only.
// This is NOT the authorization boundary — every server action, API route,
// and layout still calls requireUser()/requireStaff()/requireSuperAdmin()
// (src/lib/authz.ts) against the live session, since a stale/forged cookie
// can pass this check and the cache can lag the real role by up to 60s.
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionCookie = getSessionCookie(request);
  const isAuthPage = AUTH_PAGES.some((path) => pathname.startsWith(path));
  const isStaffPage = STAFF_PAGES.some((path) => pathname.startsWith(path));
  const isPatientPage = PATIENT_PAGES.some((path) => pathname.startsWith(path));
  const isProtectedPage = isStaffPage || isPatientPage;

  let response: NextResponse;
  if (!sessionCookie && isProtectedPage) {
    const redirectUrl = new URL("/sign-in", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    response = NextResponse.redirect(redirectUrl);
  } else if (sessionCookie && (isAuthPage || isStaffPage || isPatientPage)) {
    // Role-aware: a patient hitting a staff page is sent to their own area
    // instead of hitting the 403 boundary.
    const cache = await getCookieCache(request);
    const role = (cache?.user as { role?: string } | undefined)?.role;
    const home = role === "patient" ? "/patient" : "/dashboard";

    if (isAuthPage && role) {
      response = NextResponse.redirect(new URL(home, request.url));
    } else if (isStaffPage && role === "patient") {
      response = NextResponse.redirect(new URL("/patient", request.url));
    } else {
      response = NextResponse.next();
    }
  } else {
    response = NextResponse.next();
  }

  response.headers.set("Content-Security-Policy", buildCsp());
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|api/).*)",
  ],
};
