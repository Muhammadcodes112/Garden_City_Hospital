import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { user, session as sessionTable, activityLogs } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/authz";

const ROLES = ["patient", "admin", "super_admin"] as const;
type Role = (typeof ROLES)[number];
const ROLE_RANK: Record<Role, number> = { patient: 0, admin: 1, super_admin: 2 };

const LAST_SUPER_ADMIN_ERROR = "LAST_SUPER_ADMIN";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  // Rule 1: only a super_admin can reach this at all.
  const currentSession = await requireSuperAdmin();

  const { userId } = await params;
  const body = await request.json().catch(() => ({}));
  const newRole = body.role as string;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!ROLES.includes(newRole as Role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Rule 5: a reason is required.
  if (!reason) {
    return NextResponse.json({ error: "A reason for this role change is required." }, { status: 400 });
  }

  // Rule 2: nobody can change their own role, up or down.
  if (userId === currentSession.user.id) {
    return NextResponse.json({ error: "You cannot change your own role." }, { status: 403 });
  }

  const [targetUser] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (targetUser.deletedAt) {
    return NextResponse.json({ error: "Cannot modify role of a deleted user" }, { status: 400 });
  }

  const oldRole = targetUser.role as Role;
  if (oldRole === newRole) {
    return NextResponse.json({ error: "User already has this role." }, { status: 400 });
  }

  // Rule 4: promoting to super_admin requires 2FA already enabled.
  if (newRole === "super_admin" && !targetUser.twoFactorEnabled) {
    return NextResponse.json(
      { error: "This account must enable two-factor authentication before it can be promoted to Super Admin." },
      { status: 400 },
    );
  }

  const isDemotion = ROLE_RANK[newRole as Role] < ROLE_RANK[oldRole];
  const action = ROLE_RANK[newRole as Role] > ROLE_RANK[oldRole] ? "super_admin_promoted" : "super_admin_demoted";

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({
          role: newRole as Role,
          promotedBy: currentSession.user.id,
          promotedAt: new Date(),
          roleChangedReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));

      // Rule 3: last-remaining-super_admin check runs AFTER the update,
      // inside this same transaction — not as a pre-check — so it reflects
      // the real post-update state. (The DB trigger
      // ensure_super_admin_exists_trigger is a deferred constraint that
      // re-validates the same invariant at COMMIT as a hard backstop; this
      // check exists to surface a clean, specific error instead of a raw
      // constraint-violation message.)
      if (oldRole === "super_admin" && newRole !== "super_admin") {
        const [row] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(user)
          .where(and(eq(user.role, "super_admin"), isNull(user.deletedAt)));
        if (Number(row?.count || 0) === 0) {
          throw new Error(LAST_SUPER_ADMIN_ERROR);
        }
      }

      // Rule 6: demoting someone revokes all their sessions immediately.
      if (isDemotion) {
        await tx.delete(sessionTable).where(eq(sessionTable.userId, userId));
      }

      // Rule 7: every change writes to the activity log with actor, target,
      // old role, new role, reason, timestamp (createdAt is defaulted).
      await tx.insert(activityLogs).values({
        userId: currentSession.user.id,
        action,
        targetUserId: userId,
        oldRole,
        newRole,
        reason,
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === LAST_SUPER_ADMIN_ERROR) {
      return NextResponse.json(
        { error: "Cannot demote the last remaining Super Admin. Promote another account first." },
        { status: 400 },
      );
    }
    console.error("Failed to update user role:", err);
    return NextResponse.json({ error: "Failed to update user role" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    user: { id: userId, name: targetUser.name, email: targetUser.email, role: newRole },
  });
}
