import { NextResponse } from "next/server";
import { runActivityRetentionJob } from "@/lib/retention-activity";

export const maxDuration = 300; // 5 minutes for archiving
export const dynamic = "force-dynamic";

/**
 * Weekly Vercel Cron endpoint:
 * Archives activity_events older than 90 days to compressed monthly JSONL in Vercel Blob,
 * verifies row counts match, and only then deletes those rows.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runActivityRetentionJob();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Weekly activity_events retention cron failed:", err);
    return NextResponse.json(
      { error: err.message || "Activity retention job failed" },
      { status: 500 },
    );
  }
}
