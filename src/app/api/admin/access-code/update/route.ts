import { NextResponse } from "next/server";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { requireSuperAdminApi } from "@/lib/session";
import {
  updateRotationPeriod,
  regenerateAccessCodeNow,
  getCurrentAccessCodeInfo,
} from "@/lib/access-code";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await requireSuperAdminApi();
  if (!session) {
    return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, periodSeconds } = body;

    let updatedInfo;

    if (action === "period") {
      if (typeof periodSeconds !== "number" || periodSeconds < 3600 || periodSeconds > 7776000) {
        return NextResponse.json(
          { error: "Invalid rotation period. Must be between 1 hour and 90 days." },
          { status: 400 },
        );
      }
      updatedInfo = await updateRotationPeriod(periodSeconds, session.user.id);

      await db.insert(activityLogs).values({
        userId: session.user.id,
        action: "access_code_updated",
      });
    } else if (action === "regenerate") {
      updatedInfo = await regenerateAccessCodeNow(session.user.id);

      await db.insert(activityLogs).values({
        userId: session.user.id,
        action: "access_code_regenerated",
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      accessCode: updatedInfo,
    });
  } catch (err) {
    console.error("Failed to update access code:", err);
    return NextResponse.json({ error: "Failed to update access code" }, { status: 500 });
  }
}
