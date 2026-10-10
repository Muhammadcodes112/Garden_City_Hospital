import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie, getCookieCache } from "better-auth/cookies";

const AUTH_PAGES = ["/sign-in", "/sign-up"];
const STAFF_PAGES = [
  "/dashboard",
  "/messages",
  "/documents",
  "/lab",
  "/prescription",
  "/medical-report",
  "/patients",
  "/records",
  "/inventory",
  "/users",
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

function buildCsp(nonce: string): string {
  // script-src: nonce + strict-dynamic is the Next.js-documented pattern —
  // Next's own hydration/RSC bootstrap scripts pick up this nonce
  // automatically from the response header, so no 'unsafe-inline' is needed
  // for scripts. 'self' is a no-op fallback for browsers that don't
  // understand strict-dynamic.
  //
  // style-src keeps 'unsafe-inline': Radix UI sets inline `style="..."`
  // attributes for popover/dialog positioning, and nonces don't cover
  // third-party-injected style attributes without patching Radix itself.
  // Inline style injection can't execute script, so this is a narrower
  // risk than 'unsafe-inline' on script-src would be.
  //
  // img-src allows data:/blob: for the signature pad's canvas export and
  // client-side image blob handling.
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
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
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const pathname = request.nextUrl.pathname;
  const sessionCookie = getSessionCookie(request);
  const isAuthPage = AUTH_PAGES.some((path) => pathname.startsWith(path));
  const isStaffPage = STAFF_PAGES.some((path) => pathname.startsWith(path));
  const isPatientPage = PATIENT_PAGES.some((path) => pathname.startsWith(path));
  const isProtectedPage = isStaffPage || isPatientPage;

  let response: NextResponse;
  if (!sessionCookie && isProtectedPage) {
    response = NextResponse.redirect(new URL("/sign-in", request.url));
  } else if (sessionCookie && (isAuthPage || isStaffPage || isPatientPage)) {
    // Role-aware: a patient hitting a staff page (or vice versa) is sent to
    // their own area instead of hitting the 403 boundary or a route that
    // looks like it doesn't exist. Falls through to NextResponse.next() if
    // the role already matches the page, or the cache hasn't warmed yet
    // (requireStaff()/requireSuperAdmin() still enforce the real boundary).
    const cache = await getCookieCache(request);
    const role = (cache?.user as { role?: string } | undefined)?.role;
    const home = role === "patient" ? "/patient" : "/dashboard";

    if (isAuthPage && role) {
      response = NextResponse.redirect(new URL(home, request.url));
    } else if (isStaffPage && role === "patient") {
      response = NextResponse.redirect(new URL("/patient", request.url));
    } else if (isPatientPage && role && role !== "patient") {
      response = NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-nonce", nonce);
      response = NextResponse.next({ request: { headers: requestHeaders } });
    }
  } else {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|api/).*)",
  ],
};
