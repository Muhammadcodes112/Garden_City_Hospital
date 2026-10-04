import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAdminApi } from "@/lib/session";
import { detectFileSignature, MAX_ATTACHMENT_BYTES } from "@/lib/file-signature";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || "file";
  return base.slice(0, 200).replace(/[\x00-\x1f]/g, "");
}

export async function POST(req: NextRequest) {
  const session = await requireAdminApi();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "File uploads aren't configured on this server yet." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "File is larger than 10MB" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "File is larger than 10MB" }, { status: 413 });
  }

  const signature = detectFileSignature(buffer);
  if (!signature) {
    return NextResponse.json({ error: "Only PDF, PNG, JPG, and WEBP files are allowed" }, { status: 415 });
  }

  try {
    const blobPath = `messages/${session.user.id}/${crypto.randomUUID()}.${signature.ext}`;
    const blob = await put(blobPath, buffer, {
      access: "public",
      contentType: signature.mimeType,
    });

    return NextResponse.json({
      fileUrl: blob.url,
      fileName: sanitizeFileName(file.name),
      fileSize: buffer.length,
      mimeType: signature.mimeType,
    });
  } catch (err) {
    console.error("Failed to upload message attachment:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
