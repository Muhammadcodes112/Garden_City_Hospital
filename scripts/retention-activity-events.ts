import "dotenv/config";
import { runActivityRetentionJob } from "../src/lib/retention-activity";

async function main() {
  console.log("=== RUNNING WEEKLY ACTIVITY EVENTS RETENTION JOB ===");
  const isDryRun = process.argv.includes("--dry-run");

  const result = await runActivityRetentionJob({ dryRun: isDryRun });
  console.log("Status:", result.success ? "SUCCESS" : "FAILED");
  console.log("Message:", result.message);
  console.log(`Cutoff date (90 days): ${result.retentionCutoff}`);
  console.log(`Total archived: ${result.totalArchived}`);
  console.log(`Total purged: ${result.totalDeleted}`);

  if (result.archives.length > 0) {
    console.log("\nArchive Details:");
    for (const a of result.archives) {
      console.log(`- Month ${a.month}: ${a.rowCount} rows -> ${a.blobUrl} (purged: ${a.deletedCount})`);
    }
  }
}

main().catch((err) => {
  console.error("Retention CLI error:", err);
  process.exit(1);
});
