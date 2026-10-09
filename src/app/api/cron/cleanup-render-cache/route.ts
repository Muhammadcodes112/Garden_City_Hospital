import { NextResponse } from "next/server";
import { pruneRenderCache } from "@/lib/pdf-cache";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Check authorization header for Vercel Cron or custom CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await pruneRenderCache();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Render cache cleanup failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
