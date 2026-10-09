import { NextResponse } from "next/server";
import { and, inArray, lte, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, formRecords, shareLinks } from "@/db/schema";
import { TRASH_RETENTION_DAYS } from "@/lib/retention";

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
    const retentionCutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // Find records that have been in Trash longer than the retention window
    const expiredRecords = await db
      .select({ id: formRecords.id })
      .from(formRecords)
      .where(and(isNotNull(formRecords.deletedAt), lte(formRecords.deletedAt, retentionCutoff)));

    if (expiredRecords.length === 0) {
      return NextResponse.json({ message: "No expired trash records to clean up", count: 0 });
    }

    const recordIds = expiredRecords.map((r) => r.id);

    // Render cache (PDF/page-image blobs) is swept separately by
    // /api/cron/cleanup-render-cache, which already treats any trashed
    // record as stale — no need to purge it again here.

    // 2. Delete share links
    await db.delete(shareLinks).where(inArray(shareLinks.formRecordId, recordIds));

    // 3. Log permanent deletion
    for (const id of recordIds) {
      await db.insert(activityLogs).values({
        userId: "system_cron",
        formRecordId: null,
        action: "permanently_deleted",
      });
    }

    // 4. Permanently delete from formRecords
    await db.delete(formRecords).where(inArray(formRecords.id, recordIds));

    return NextResponse.json({
      success: true,
      purgedCount: recordIds.length,
      purgedRecordIds: recordIds,
    });
  } catch (err) {
    console.error("Cron trash cleanup failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
