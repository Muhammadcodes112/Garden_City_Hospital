import { NextResponse } from "next/server";
import { gte, desc } from "drizzle-orm";
import { db } from "@/db";
import { failedSignups } from "@/db/schema";
import { requireSuperAdminApi } from "@/lib/session";
import { getCurrentAccessCodeInfo } from "@/lib/access-code";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSuperAdminApi();
  if (!session) {
    return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
  }

  try {
    const codeInfo = await getCurrentAccessCodeInfo();

    // Fetch failed signups in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFailures = await db
      .select({
        id: failedSignups.id,
        ipAddress: failedSignups.ipAddress,
        email: failedSignups.email,
        reason: failedSignups.reason,
        createdAt: failedSignups.createdAt,
      })
      .from(failedSignups)
      .where(gte(failedSignups.createdAt, sevenDaysAgo))
      .orderBy(desc(failedSignups.createdAt))
      .limit(20);

    return NextResponse.json({
      accessCode: codeInfo,
      recentFailures: recentFailures.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("Failed to fetch access code info:", err);
    return NextResponse.json({ error: "Failed to fetch access code info" }, { status: 500 });
  }
}
