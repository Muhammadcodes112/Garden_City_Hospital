import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, session as sessionTable, activityLogs } from "@/db/schema";
import { requireSuperAdminApi } from "@/lib/session";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  const currentSession = await requireSuperAdminApi();
  if (!currentSession) {
    return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
  }

  const { userId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { confirmEmail } = body;

  const [targetUser] = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Super admin immutability checks
  if (targetUser.role === "super_admin") {
    return NextResponse.json(
      { error: "Forbidden: The Super Admin account cannot be deleted or demoted." },
      { status: 403 },
    );
  }

  if (targetUser.id === currentSession.user.id) {
    return NextResponse.json(
      { error: "Forbidden: You cannot delete your own Super Admin account." },
      { status: 403 },
    );
  }

  if (!confirmEmail || confirmEmail.trim().toLowerCase() !== targetUser.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Email confirmation does not match the target admin's email." },
      { status: 400 },
    );
  }

  try {
    // 1. Immediately revoke all active sessions
    await db.delete(sessionTable).where(eq(sessionTable.userId, userId));

    // 2. Soft-delete account (medical records in form_records are retained!)
    const now = new Date();
    await db
      .update(user)
      .set({
        deletedAt: now,
        banned: true,
        banReason: `Account deleted by Super Admin ${currentSession.user.email}`,
      })
      .where(eq(user.id, userId));

    // 3. Log deletion activity
    await db.insert(activityLogs).values({
      userId: currentSession.user.id,
      action: "account_deleted",
    });

    return NextResponse.json({
      success: true,
      message: `Account for ${targetUser.email} has been deleted and sessions revoked. Medical records created by them were retained.`,
    });
  } catch (err) {
    console.error("Failed to delete admin account:", err);
    return NextResponse.json({ error: "Failed to delete admin account" }, { status: 500 });
  }
}
