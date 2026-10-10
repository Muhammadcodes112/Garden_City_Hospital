import { NextResponse } from "next/server";
import { gte, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import { user, session as sessionTable, formRecords } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/authz";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  const currentSession = await requireSuperAdmin();

  try {
    const allUsers = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: user.banned,
        deletedAt: user.deletedAt,
        createdAt: user.createdAt,
        twoFactorEnabled: user.twoFactorEnabled,
      })
      .from(user)
      .orderBy(desc(user.createdAt));

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Active users this week
    const activeSessions = await db
      .select({ userId: sessionTable.userId })
      .from(sessionTable)
      .where(gte(sessionTable.updatedAt, sevenDaysAgo));

    const activeUserIds = new Set(activeSessions.map((s) => s.userId));

    // Form counts per user
    const formCounts = await db
      .select({
        createdBy: formRecords.createdBy,
        count: sql<number>`count(*)`,
      })
      .from(formRecords)
      .groupBy(formRecords.createdBy);

    const formCountMap = new Map(formCounts.map((f) => [f.createdBy, Number(f.count)]));

    // Last active timestamp per user
    const lastActiveRows = await db
      .select({
        userId: sessionTable.userId,
        lastActive: sql<string>`max(${sessionTable.updatedAt})`,
      })
      .from(sessionTable)
      .groupBy(sessionTable.userId);

    const lastActiveMap = new Map(lastActiveRows.map((r) => [r.userId, r.lastActive]));

    // Last sign-in: when their most recent session was CREATED, as distinct
    // from lastActiveAt (session.updatedAt, which also moves on ongoing
    // token refresh within an existing session, not just at sign-in).
    const lastSignInRows = await db
      .select({
        userId: sessionTable.userId,
        lastSignIn: sql<string>`max(${sessionTable.createdAt})`,
      })
      .from(sessionTable)
      .groupBy(sessionTable.userId);

    const lastSignInMap = new Map(lastSignInRows.map((r) => [r.userId, r.lastSignIn]));

    const usersList = allUsers.map((u) => {
      const isDeleted = Boolean(u.deletedAt);
      const status = isDeleted ? "deleted" : u.banned ? "banned" : "active";
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role || "patient",
        createdAt: u.createdAt.toISOString(),
        deletedAt: u.deletedAt ? u.deletedAt.toISOString() : null,
        banned: u.banned || false,
        status,
        formsCount: formCountMap.get(u.id) || 0,
        lastActiveAt: lastActiveMap.get(u.id) || null,
        lastSignInAt: lastSignInMap.get(u.id) || null,
        twoFactorEnabled: Boolean(u.twoFactorEnabled),
        isSuperAdmin: u.role === "super_admin",
      };
    });

    const activeAdminsCount = usersList.filter((u) => u.status !== "deleted").length;
    const activeThisWeekCount = usersList.filter((u) => activeUserIds.has(u.id)).length;
    const newThisMonthCount = usersList.filter((u) => new Date(u.createdAt) >= thirtyDaysAgo).length;

    return NextResponse.json({
      stats: {
        totalAdmins: activeAdminsCount,
        activeThisWeek: activeThisWeekCount,
        newThisMonth: newThisMonthCount,
      },
      users: usersList,
    });
  } catch (err) {
    console.error("Failed to fetch admin users:", err);
    return NextResponse.json({ error: "Failed to fetch admin users" }, { status: 500 });
  }
}
