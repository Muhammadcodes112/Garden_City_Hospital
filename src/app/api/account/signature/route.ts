import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import fs from "fs";
import path from "path";
import { requireStaff } from "@/lib/authz";
import { db } from "@/db";
import { user } from "@/db/schema";
import { detectFileSignature, MAX_ATTACHMENT_BYTES } from "@/lib/file-signature";
import { logEvent, type ActorRole } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: NextRequest) {
  const session = await requireStaff();

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
  const signature = detectFileSignature(buffer);
  if (!signature || !ALLOWED_MIME_TYPES.has(signature.mimeType)) {
    return NextResponse.json({ error: "Only PNG, JPG, and WEBP images are allowed" }, { status: 415 });
  }

  let signatureUrl: string;
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blobPath = `signatures/${session.user.id}/${crypto.randomUUID()}.${signature.ext}`;
      const blob = await put(blobPath, buffer, {
        access: "public",
        contentType: signature.mimeType,
      });
      signatureUrl = blob.url;
    } else {
      try {
        const uploadDir = path.join(process.cwd(), "public", "uploads", "signatures");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const fileName = `${session.user.id}-${Date.now()}.${signature.ext}`;
        fs.writeFileSync(path.join(uploadDir, fileName), buffer);
        signatureUrl = `/uploads/signatures/${fileName}`;
      } catch {
        signatureUrl = `data:${signature.mimeType};base64,${buffer.toString("base64")}`;
      }
    }
  } catch (err) {
    console.error("Failed to upload signature:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  await db
    .update(user)
    .set({ signatureUrl, signatureUpdatedAt: new Date() })
    .where(eq(user.id, session.user.id));

  await logEvent({
    category: "accounts",
    action: "signature.updated",
    summary: `${session.user.name} updated their saved signature`,
    actorId: session.user.id,
    actorRoleAtTime: (session.user as { role?: ActorRole }).role ?? null,
    actorLabel: session.user.name,
    targetType: "user",
    targetId: session.user.id,
  });

  return NextResponse.json({ signatureUrl });
}

export async function DELETE() {
  const session = await requireStaff();

  await db
    .update(user)
    .set({ signatureUrl: null, signatureUpdatedAt: new Date() })
    .where(eq(user.id, session.user.id));

  await logEvent({
    category: "accounts",
    action: "signature.removed",
    summary: `${session.user.name} removed their saved signature`,
    actorId: session.user.id,
    actorRoleAtTime: (session.user as { role?: ActorRole }).role ?? null,
    actorLabel: session.user.name,
    targetType: "user",
    targetId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
