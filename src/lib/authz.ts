import "server-only";
import { forbidden, unauthorized } from "next/navigation";
import { getSession } from "@/lib/session";

export type Role = "patient" | "cashier" | "admin" | "super_admin";

/** Clinical staff. A cashier is deliberately NOT in this list. */
export const STAFF_ROLES = ["admin", "super_admin"] as const;

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

/**
 * Clinical staff only: admin or super_admin. Patients AND cashiers are
 * forbidden — a cashier is staff but not clinical, so every route this
 * protects (forms, records, patient files, messages, appointments,
 * inventory) stays closed to them. Cashier routes use requireCashierArea().
 */
export async function requireStaff(): Promise<Session> {
  const session = await requireUser();
  const role = roleOf(session);
  if (role !== "admin" && role !== "super_admin") forbidden();
  return session;
}

/**
 * The cashier area (/cashier): a cashier, or a Super Admin (who can see
 * every cashier's shifts and receipts and void them, but not issue).
 */
export async function requireCashierArea(): Promise<{ session: Session; role: "cashier" | "super_admin" }> {
  const session = await requireUser();
  const role = roleOf(session);
  if (role !== "cashier" && role !== "super_admin") forbidden();
  return { session, role };
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
