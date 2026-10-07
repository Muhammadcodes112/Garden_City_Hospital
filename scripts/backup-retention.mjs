// Prunes old DB backups from Vercel Blob after a fresh one is uploaded.
// Keeps: every backup from the last 30 days, PLUS the first backup of each
// calendar month for the last 12 months. Everything else is deleted.
//
// Run by .github/workflows/backup-db.yml right after uploading today's dump.
//
// Never logs a blob's pathname or url: this repo is public, so GitHub
// Actions logs are world-readable, and a backup blob's path is effectively
// a bearer credential for the entire patient database (Vercel Blob has no
// private-ACL concept — see src/app/api/messages/attachments/upload/route.ts
// for the same constraint on message file attachments).
import { list, del } from "@vercel/blob";

const PREFIX = "backups/db/";
const DAILY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MONTHLY_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

async function main() {
  const now = Date.now();
  const { blobs } = await list({ prefix: PREFIX });

  const entries = blobs
    .map((b) => ({ pathname: b.pathname, url: b.url, timestamp: new Date(b.uploadedAt).getTime() }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const seenMonths = new Set();
  const toDelete = [];
  let keptCount = 0;

  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    const ageMs = now - entry.timestamp;
    const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const isFirstOfMonth = !seenMonths.has(monthKey);
    if (isFirstOfMonth) seenMonths.add(monthKey);

    const keepAsDaily = ageMs <= DAILY_WINDOW_MS;
    const keepAsMonthly = isFirstOfMonth && ageMs <= MONTHLY_WINDOW_MS;

    if (keepAsDaily || keepAsMonthly) {
      keptCount += 1;
    } else {
      toDelete.push(entry.url);
    }
  }

  console.log(`Found ${entries.length} backups. Keeping ${keptCount}, deleting ${toDelete.length}.`);
  if (toDelete.length > 0) {
    await del(toDelete);
    console.log(`Deleted ${toDelete.length} backup(s) outside the retention window.`);
  }
}

main().catch((err) => {
  console.error("Backup retention failed:", err?.message ?? err);
  process.exit(1);
});
