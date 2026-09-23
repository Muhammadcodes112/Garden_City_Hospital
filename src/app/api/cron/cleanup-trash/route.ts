import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { and, inArray, lte, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, formRecords, shareLinks } from "@/db/schema";

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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Find records in Trash for > 30 days
    const expiredRecords = await db
      .select({ id: formRecords.id })
      .from(formRecords)
      .where(and(isNotNull(formRecords.deletedAt), lte(formRecords.deletedAt, thirtyDaysAgo)));

    if (expiredRecords.length === 0) {
      return NextResponse.json({ message: "No expired trash records to clean up", count: 0 });
    }

    const recordIds = expiredRecords.map((r) => r.id);

    // 1. Purge preview images from disk
    const cacheDir = path.join(process.cwd(), "public", "cache", "page-previews");
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      for (const file of files) {
        if (recordIds.some((id) => file.startsWith(id))) {
          try {
            fs.unlinkSync(path.join(cacheDir, file));
          } catch (e) {
            console.error("Error unlinking preview file:", file, e);
          }
        }
      }
    }

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
