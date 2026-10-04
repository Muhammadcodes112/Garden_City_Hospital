import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { messageAttachments, messages } from "@/db/schema";
import { requireAdminApi } from "@/lib/session";
import { isParticipant } from "@/lib/messages";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Proxies a file attachment's bytes after verifying the caller is a
 * participant in the message's conversation. The underlying Vercel Blob URL
 * is never returned to the client — only this authenticated route ever
 * fetches it.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const session = await requireAdminApi();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attachmentId } = await params;

  const [attachment] = await db.select().from(messageAttachments).where(eq(messageAttachments.id, attachmentId));
  if (!attachment || attachment.kind !== "file" || !attachment.fileUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [message] = await db.select({ conversationId: messages.conversationId }).from(messages).where(eq(messages.id, attachment.messageId));
  if (!message) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await isParticipant(message.conversationId, session.user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let blobRes: Response;
  try {
    blobRes = await fetch(attachment.fileUrl);
  } catch (err) {
    console.error("Failed to fetch blob for attachment", attachmentId, err);
    return NextResponse.json({ error: "File unavailable" }, { status: 502 });
  }
  if (!blobRes.ok || !blobRes.body) {
    return NextResponse.json({ error: "File unavailable" }, { status: 502 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  const headers = new Headers();
  headers.set("Content-Type", attachment.mimeType || "application/octet-stream");
  if (attachment.fileSize) headers.set("Content-Length", String(attachment.fileSize));
  headers.set(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${(attachment.fileName || "file").replace(/"/g, "")}"`,
  );
  headers.set("Cache-Control", "private, max-age=3600");

  return new NextResponse(blobRes.body, { headers });
}
