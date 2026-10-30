import { cache } from "react";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import type { Role } from "@/lib/authz";

/**
 * Returns the current session, or null if the request is unauthenticated.
 * Wrapped in React cache() so concurrent layout/page calls within a single
 * server render share the exact same lookup without redundant DB queries.
 *
 * Enriches with the live database user record so that role, banned, and deletedAt
 * are always 100% accurate and fresh — preventing 403 Forbidden errors when an
 * account is promoted to super_admin or admin, or when an account is unbanned.
 */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  try {
    const [dbUser] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: user.banned,
        deletedAt: user.deletedAt,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!dbUser) return null;

    return {
      ...session,
      user: {
        ...session.user,
        name: dbUser.name ?? session.user.name,
        email: dbUser.email ?? session.user.email,
        role: (dbUser.role ?? "patient") as Role,
        banned: Boolean(dbUser.banned),
        deletedAt: dbUser.deletedAt,
      },
    };
  } catch (err) {
    console.error("Failed to enrich session with db user:", err);
    return session;
  }
});

