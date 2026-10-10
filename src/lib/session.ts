import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Returns the current session, or null if the request is unauthenticated.
 * This is the one low-level primitive — role/staff/super-admin checks live
 * in src/lib/authz.ts (requireUser/requireStaff/requireSuperAdmin), which
 * every protected server path uses instead of checking roles ad hoc here.
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
