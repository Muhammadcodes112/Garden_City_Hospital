import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const AUTH_PAGES = ["/sign-in", "/sign-up"];
const PROTECTED_PAGES = [
  "/dashboard",
  "/messages",
  "/documents",
  "/lab",
  "/prescription",
  "/medical-report",
  "/patients",
  "/records",
  "/inventory",
  "/admins",
];

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

// Lightweight, cookie-presence-only check. This is NOT the authorization
// boundary — every server action and API route still calls requireAdmin()
// (src/lib/session.ts) against the real session, since a stale/forged
// cookie can pass this check.
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const pathname = request.nextUrl.pathname;
  const sessionCookie = getSessionCookie(request);
  const isAuthPage = AUTH_PAGES.some((path) => pathname.startsWith(path));
  const isProtectedPage = PROTECTED_PAGES.some((path) => pathname.startsWith(path));

  let response: NextResponse;
  if (!sessionCookie && isProtectedPage) {
    response = NextResponse.redirect(new URL("/sign-in", request.url));
  } else if (sessionCookie && isAuthPage) {
    response = NextResponse.redirect(new URL("/dashboard", request.url));
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
