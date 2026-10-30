import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/authz";
import { logEvent } from "@/lib/activity";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  const currentSession = await requireSuperAdmin();
  const { userId } = await ctx.params;

  const [targetUser] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      deletedAt: user.deletedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    await db
      .update(user)
      .set({
        banned: false,
        banReason: null,
        banExpires: null,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    await logEvent({
      category: "accounts",
      action: "account.restored",
      summary: `${currentSession.user.name} restored and unbanned account for ${targetUser.name} (${targetUser.email})`,
      actorId: currentSession.user.id,
      actorRoleAtTime: "super_admin",
      actorLabel: currentSession.user.name,
      targetType: "user",
      targetId: userId,
      metadata: { email: targetUser.email, name: targetUser.name, role: targetUser.role },
    });

    return NextResponse.json({
      success: true,
      message: `Account for ${targetUser.email} has been restored and unbanned successfully.`,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        status: "active",
      },
    });
  } catch (err) {
    console.error("Failed to restore user account:", err);
    return NextResponse.json({ error: "Failed to restore user account" }, { status: 500 });
  }
}
