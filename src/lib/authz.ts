import "server-only";
import { forbidden, unauthorized } from "next/navigation";
import { getSession } from "@/lib/session";

export type Role = "patient" | "admin" | "super_admin";

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;
type SessionUser = Session["user"] & {
  role?: Role | null;
  banned?: boolean | null;
  deletedAt?: string | Date | null;
};

function roleOf(session: Session): Role {
  return ((session.user as SessionUser).role ?? "patient") as Role;
}

/**
 * The single authorization checkpoint every protected server path goes
 * through — pages, layouts, server actions, and route handlers alike.
 * Each function below returns a valid session or interrupts the request via
 * Next's forbidden()/unauthorized() (next/navigation): a real 401/403 in
 * Route Handlers, and the forbidden.tsx/unauthorized.tsx boundary in
 * rendered routes. There is no boolean return a caller could forget to
 * check — failure to authorize always terminates the request here.
 */

/** Any signed-in, non-banned, non-deleted account — patient, admin, or super_admin. */
export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) unauthorized();
  const u = session.user as SessionUser;
  if (u.banned || u.deletedAt) unauthorized();
  return session;
}

/** Staff only: admin or super_admin. Patients are forbidden. */
export async function requireStaff(): Promise<Session> {
  const session = await requireUser();
  const role = roleOf(session);
  if (role !== "admin" && role !== "super_admin") forbidden();
  return session;
}

/** Super Admin only. */
export async function requireSuperAdmin(): Promise<Session> {
  const session = await requireUser();
  if (roleOf(session) !== "super_admin") forbidden();
  return session;
}

/** Reads the role off an already-fetched session without re-authorizing. */
export function getRole(session: Session): Role {
  return roleOf(session);
}
