import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const AUTH_PAGES = ["/sign-in", "/sign-up"];

// Lightweight, cookie-presence-only check. This is NOT the authorization
// boundary — every server action and API route still calls requireAdmin()
// (src/lib/session.ts) against the real session, since a stale/forged
// cookie can pass this check.
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const isAuthPage = AUTH_PAGES.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!sessionCookie && !isAuthPage) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  if (sessionCookie && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/lab/:path*",
    "/prescription/:path*",
    "/medical-report/:path*",
    "/sign-in",
    "/sign-up",
  ],
};
