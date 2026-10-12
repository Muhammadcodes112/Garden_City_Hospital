import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireSuperAdmin } from "@/lib/authz";
import { logEvent } from "@/lib/activity";
import {
  updateRotationPeriod,
  regenerateAccessCodeNow,
  getCurrentAccessCodeInfo,
} from "@/lib/access-code";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await requireSuperAdmin();

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

      await logEvent({
        category: "accounts",
        action: "access_code.period_changed",
        summary: `${session.user.name} changed rotation period to ${Math.round(periodSeconds / 86400)} days`,
        actorId: session.user.id,
        actorRoleAtTime: "super_admin",
        actorLabel: session.user.name,
        targetType: "access_code_settings",
        metadata: { periodSeconds },
      });
    } else if (action === "regenerate") {
      updatedInfo = await regenerateAccessCodeNow(session.user.id);

      await logEvent({
        category: "accounts",
        action: "access_code.regenerated",
        summary: `${session.user.name} regenerated the staff access code`,
        actorId: session.user.id,
        actorRoleAtTime: "super_admin",
        actorLabel: session.user.name,
        targetType: "access_code_settings",
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
