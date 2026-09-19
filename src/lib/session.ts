import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Returns the current session, or null if the request is unauthenticated. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Server-side guard for every protected page and data action. Every admin
 * route/action must call this before touching patient data — there is no
 * other authorization layer.
 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}

/**
 * API-route variant of requireAdmin(): returns the session, or null if
 * unauthenticated. Route handlers respond with 401 rather than redirecting.
 */
export async function requireAdminApi() {
  const session = await getSession();
  return session ?? null;
}
