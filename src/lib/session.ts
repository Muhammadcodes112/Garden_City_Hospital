import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Returns the current session, or null if the request is unauthenticated. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Server-side guard for admin pages/actions. */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const userObj = session.user as typeof session.user & {
    role?: string;
    banned?: boolean;
    deletedAt?: string | null;
  };
  if (userObj.banned || userObj.deletedAt) {
    redirect("/sign-in");
  }
  return session;
}

/** API-route variant of requireAdmin(): returns session or null if unauthenticated. */
export async function requireAdminApi() {
  const session = await getSession();
  if (!session) return null;
  const userObj = session.user as typeof session.user & {
    role?: string;
    banned?: boolean;
    deletedAt?: string | null;
  };
  if (userObj.banned || userObj.deletedAt) return null;
  return session;
}

/** Strict server-side guard for Super Admin actions/pages. */
export async function requireSuperAdmin() {
  const session = await requireAdmin();
  const userObj = session.user as typeof session.user & { role?: string };
  if (userObj.role !== "super_admin") {
    redirect("/dashboard");
  }
  return session;
}

/** Strict API-route variant for Super Admin endpoints (returns null for non-super-admins). */
export async function requireSuperAdminApi() {
  const session = await requireAdminApi();
  if (!session) return null;
  const userObj = session.user as typeof session.user & { role?: string };
  if (userObj.role !== "super_admin") return null;
  return session;
}
