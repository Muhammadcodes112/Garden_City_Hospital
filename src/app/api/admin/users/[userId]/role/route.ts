import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, activityLogs } from "@/db/schema";
import { requireSuperAdminApi } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const currentSession = await requireSuperAdminApi();
  if (!currentSession) {
    return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
  }

  const { userId } = await params;
  const body = await request.json().catch(() => ({}));
  const newRole = body.role === "super_admin" ? "super_admin" : "admin";

  try {
    const targetRows = await db.select().from(user).where(eq(user.id, userId)).limit(1);
    const targetUser = targetRows[0];

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.deletedAt) {
      return NextResponse.json({ error: "Cannot modify role of a deleted user" }, { status: 400 });
    }

    // Protect primary super admin email from demotion
    const primarySuperAdminEmail = (process.env.SUPER_ADMIN_EMAIL || "funguyallen@gmail.com").toLowerCase();
    if (newRole === "admin" && targetUser.email.toLowerCase() === primarySuperAdminEmail) {
      return NextResponse.json(
        { error: "The primary Super Admin account cannot be demoted." },
        { status: 400 },
      );
    }

    await db
      .update(user)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    await db.insert(activityLogs).values({
      userId: currentSession.user.id,
      formRecordId: null,
      action: newRole === "super_admin" ? "super_admin_promoted" : "super_admin_demoted",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: newRole,
      },
    });
  } catch (err) {
    console.error("Failed to update user role:", err);
    return NextResponse.json({ error: "Failed to update user role" }, { status: 500 });
  }
}
