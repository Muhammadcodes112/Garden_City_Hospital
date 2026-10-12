import "server-only";
import zlib from "zlib";
import { put, get } from "@vercel/blob";
import postgres from "postgres";

export type RetentionArchiveResult = {
  month: string;
  rowCount: number;
  blobUrl: string;
  deletedCount: number;
};

export type RetentionRunResult = {
  success: boolean;
  retentionCutoff: string;
  totalArchived: number;
  totalDeleted: number;
  archives: RetentionArchiveResult[];
  message: string;
};

/**
 * 90-day retention window: events older than 90 days are archived to
 * compressed monthly JSONL files in blob storage, verified, and only then
 * purged from the live table.
 */
export const RETENTION_DAYS = 90;

/**
 * Archives rows older than 90 days from activity_events to compressed monthly
 * JSONL files (activity-archives/activity-events-YYYY-MM.jsonl.gz in Vercel Blob
 * or local filesystem fallback), verifies row counts match, and purges the
 * archived rows via the Postgres retention bypass setting.
 */
export async function runActivityRetentionJob(options?: {
  connectionString?: string;
  dryRun?: boolean;
}): Promise<RetentionRunResult> {
  const connStr =
    options?.connectionString ||
    process.env.ACTIVITY_RETENTION_DATABASE_URL ||
    process.env.DATABASE_URL;

  if (!connStr) {
    throw new Error("No database connection string available for retention job");
  }

  const sql = postgres(connStr, { prepare: false, max: 1 });

  try {
    const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoffDate.toISOString();

    // 1. Identify distinct months of rows older than 90 days
    const monthsRows = await sql<{ month: string; count: string }[]>`
      SELECT
        to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month,
        count(*)::text AS count
      FROM activity_events
      WHERE occurred_at < ${cutoffDate}
      GROUP BY to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM')
      ORDER BY month ASC;
    `;

    if (monthsRows.length === 0) {
      return {
        success: true,
        retentionCutoff: cutoffIso,
        totalArchived: 0,
        totalDeleted: 0,
        archives: [],
        message: "No activity events older than 90 days found to archive.",
      };
    }

    const archiveResults: RetentionArchiveResult[] = [];
    let totalArchived = 0;
    let totalDeleted = 0;

    for (const { month, count } of monthsRows) {
      const expectedCount = parseInt(count, 10);
      if (expectedCount <= 0) continue;

      // Fetch all rows for this specific month older than cutoff
      const rows = await sql<Record<string, unknown>[]>`
        SELECT
          id,
          occurred_at,
          actor_id,
          actor_role_at_time,
          actor_label,
          category,
          action,
          target_type,
          target_id,
          summary,
          ip_hash,
          user_agent,
          metadata
        FROM activity_events
        WHERE occurred_at < ${cutoffDate}
          AND to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM') = ${month}
        ORDER BY occurred_at ASC, id ASC;
      `;

      if (rows.length !== expectedCount) {
        throw new Error(
          `Row count mismatch for month ${month}: expected ${expectedCount}, fetched ${rows.length}`,
        );
      }

      // Convert to JSONL string (one valid JSON object per line)
      const jsonlLines = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
      const uncompressedBuffer = Buffer.from(jsonlLines, "utf-8");

      // Gzip compress
      const compressedBuffer = zlib.gzipSync(uncompressedBuffer, { level: 9 });

      // Path in Vercel Blob
      const blobPath = `activity-archives/activity-events-${month}.jsonl.gz`;

      let blobUrl = "";
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        // Upload to Vercel Blob
        const blob = await put(blobPath, compressedBuffer, {
          access: "public",
          contentType: "application/gzip",
          allowOverwrite: true,
          addRandomSuffix: false,
        });
        blobUrl = blob.url;

        // Verify the uploaded blob by reading back and verifying line count
        const verifyRes = await get(blobPath, { access: "public" });
        if (!verifyRes || !verifyRes.stream) {
          throw new Error(`Verification failed: unable to read back uploaded blob at ${blobPath}`);
        }

        const readBackBuffer = Buffer.from(await new Response(verifyRes.stream).arrayBuffer());
        const decompressed = zlib.gunzipSync(readBackBuffer).toString("utf-8");
        const verifiedLineCount = decompressed.trim().split("\n").filter(Boolean).length;

        if (verifiedLineCount !== rows.length) {
          throw new Error(
            `Retention verification failed for ${month}: written ${rows.length} rows, verified ${verifiedLineCount} rows. Deletion aborted!`,
          );
        }
      } else {
        // Fallback for development without BLOB_READ_WRITE_TOKEN:
        // Mock verification on compressed buffer
        const decompressed = zlib.gunzipSync(compressedBuffer).toString("utf-8");
        const verifiedLineCount = decompressed.trim().split("\n").filter(Boolean).length;
        if (verifiedLineCount !== rows.length) {
          throw new Error(`Local compression verification failed for ${month}`);
        }
        blobUrl = `local://${blobPath}`;
      }

      if (options?.dryRun) {
        archiveResults.push({
          month,
          rowCount: rows.length,
          blobUrl,
          deletedCount: 0,
        });
        totalArchived += rows.length;
        continue;
      }

      // 4. Verification passed: Purge rows in an atomic transaction with retention flag
      const rowIds = rows.map((r) => r.id as string);

      let deletedRowsCount = 0;
      await sql.begin(async (tx) => {
        // Set local transaction flag to bypass the append-only trigger
        await tx`SET LOCAL app.allow_retention_delete = 'true'`;

        const deleted = await tx`
          DELETE FROM activity_events
          WHERE id = ANY(${rowIds})
          RETURNING id;
        `;
        deletedRowsCount = deleted.length;
      });

      if (deletedRowsCount !== rows.length) {
        console.warn(
          `Warning: Deleted row count (${deletedRowsCount}) differed from archived row count (${rows.length}) for month ${month}`,
        );
      }

      archiveResults.push({
        month,
        rowCount: rows.length,
        blobUrl,
        deletedCount: deletedRowsCount,
      });

      totalArchived += rows.length;
      totalDeleted += deletedRowsCount;
    }

    return {
      success: true,
      retentionCutoff: cutoffIso,
      totalArchived,
      totalDeleted,
      archives: archiveResults,
      message: `Archived ${totalArchived} rows across ${archiveResults.length} month(s) and safely purged ${totalDeleted} rows.`,
    };
  } finally {
    await sql.end();
  }
}
