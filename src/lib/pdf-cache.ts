import { del, get, list, put } from "@vercel/blob";
import { isNull } from "drizzle-orm";
import { db } from "@/db";
import { formRecords } from "@/db/schema";

const ROOT = "render-cache";
const PDF_NS = `${ROOT}/pdf`;
const IMAGE_NS = `${ROOT}/image`;

function ts(updatedAt: Date | string): number {
  return new Date(updatedAt).getTime();
}

function pdfKey(recordId: string, updatedAt: Date | string): string {
  return `${PDF_NS}/${recordId}/${ts(updatedAt)}.pdf`;
}

function imageKey(recordId: string, updatedAt: Date | string, pageIndex: number, resolution: "low" | "high"): string {
  return `${IMAGE_NS}/${recordId}/${ts(updatedAt)}_p${pageIndex}_${resolution}.png`;
}

function imageMetaKey(recordId: string, updatedAt: Date | string): string {
  return `${IMAGE_NS}/${recordId}/${ts(updatedAt)}_meta.json`;
}

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function getCachedBuffer(pathname: string): Promise<Buffer | null> {
  if (!blobConfigured()) return null;
  try {
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  } catch (err) {
    console.error("Render cache read failed:", pathname, err);
    return null;
  }
}

async function putCachedBuffer(pathname: string, buffer: Buffer, contentType: string): Promise<void> {
  if (!blobConfigured()) return;
  try {
    await put(pathname, buffer, { access: "private", contentType, allowOverwrite: true });
  } catch (err) {
    // Non-fatal — the caller already has the freshly-rendered buffer to serve.
    console.error("Render cache write failed:", pathname, err);
  }
}

// --- PDF ---

export async function getCachedPdf(recordId: string, updatedAt: Date | string): Promise<Buffer | null> {
  return getCachedBuffer(pdfKey(recordId, updatedAt));
}

export async function putCachedPdf(recordId: string, updatedAt: Date | string, buffer: Buffer): Promise<void> {
  return putCachedBuffer(pdfKey(recordId, updatedAt), buffer, "application/pdf");
}

/** Cache-through wrapper: on a miss, calls `render()` (expected to invoke Chromium) and stores the result. */
export async function renderPdfCached(
  recordId: string,
  updatedAt: Date | string,
  render: () => Promise<Buffer>,
): Promise<Buffer> {
  const cached = await getCachedPdf(recordId, updatedAt);
  if (cached) return cached;
  const buffer = await render();
  await putCachedPdf(recordId, updatedAt, buffer);
  return buffer;
}

// --- Page images (+ a small meta blob carrying pageCount) ---

type ImageMeta = { pageCount: number };

export async function getCachedImage(
  recordId: string,
  updatedAt: Date | string,
  pageIndex: number,
  resolution: "low" | "high",
): Promise<{ buffer: Buffer; pageCount: number } | null> {
  const [buffer, metaBuffer] = await Promise.all([
    getCachedBuffer(imageKey(recordId, updatedAt, pageIndex, resolution)),
    getCachedBuffer(imageMetaKey(recordId, updatedAt)),
  ]);
  if (!buffer || !metaBuffer) return null;
  try {
    const meta = JSON.parse(metaBuffer.toString("utf8")) as ImageMeta;
    return { buffer, pageCount: meta.pageCount || 1 };
  } catch {
    return null;
  }
}

export async function putCachedImage(
  recordId: string,
  updatedAt: Date | string,
  pageIndex: number,
  resolution: "low" | "high",
  buffer: Buffer,
  pageCount: number,
): Promise<void> {
  await Promise.all([
    putCachedBuffer(imageKey(recordId, updatedAt, pageIndex, resolution), buffer, "image/png"),
    putCachedBuffer(imageMetaKey(recordId, updatedAt), Buffer.from(JSON.stringify({ pageCount } satisfies ImageMeta)), "application/json"),
  ]);
}

// --- Cleanup cron ---

/**
 * Deletes cached render blobs that no longer correspond to a record's
 * current (recordId, updatedAt) key — either because the record was
 * deleted outright, or because it's been edited since (orphaning the
 * previous version's cache entries).
 */
export async function pruneRenderCache(): Promise<{ scanned: number; deleted: number; kept: number }> {
  if (!blobConfigured()) return { scanned: 0, deleted: 0, kept: 0 };

  // Excludes soft-deleted (Trash) records on purpose: there's no normal
  // viewing path for a trashed record's PDF/images, so their cache is
  // pruned immediately rather than kept around for the 30-day trash
  // window — same outcome as a hard delete, just a bit earlier.
  const records = await db
    .select({ id: formRecords.id, updatedAt: formRecords.updatedAt })
    .from(formRecords)
    .where(isNull(formRecords.deletedAt));
  const currentTsByRecord = new Map(records.map((r) => [r.id, ts(r.updatedAt)]));

  let scanned = 0;
  let deleted = 0;
  let kept = 0;
  const toDelete: string[] = [];

  for (const prefix of [PDF_NS, IMAGE_NS]) {
    let cursor: string | undefined;
    do {
      const { blobs, cursor: next, hasMore } = await list({ prefix: `${prefix}/`, cursor, limit: 1000 });
      for (const blob of blobs) {
        scanned += 1;
        // Pathname shape: `${prefix}/${recordId}/${timestamp}...`
        const rest = blob.pathname.slice(prefix.length + 1);
        const slash = rest.indexOf("/");
        if (slash === -1) continue;
        const recordId = rest.slice(0, slash);
        const fileTsMatch = rest.slice(slash + 1).match(/^(\d+)/);
        const fileTs = fileTsMatch ? Number(fileTsMatch[1]) : NaN;

        const currentTs = currentTsByRecord.get(recordId);
        if (currentTs === undefined || currentTs !== fileTs) {
          toDelete.push(blob.pathname);
          deleted += 1;
        } else {
          kept += 1;
        }
      }
      cursor = hasMore ? next : undefined;
    } while (cursor);
  }

  if (toDelete.length > 0) {
    // del() accepts up to 1000 pathnames per call per Vercel Blob's limits.
    for (let i = 0; i < toDelete.length; i += 1000) {
      await del(toDelete.slice(i, i + 1000));
    }
  }

  return { scanned, deleted, kept };
}
