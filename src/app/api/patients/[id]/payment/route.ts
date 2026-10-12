import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logEvent } from "@/lib/activity";
import { detectFileSignature, MAX_ATTACHMENT_BYTES } from "@/lib/file-signature";
import { put } from "@vercel/blob";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireStaff();
  const { id } = await params;

  try {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const contentType = req.headers.get("content-type") || "";
    let isPaid = false;
    let amount = "";
    let method = "";
    let reference = "";
    let notes = "";
    let removeEvidence = false;
    let evidenceUrl = patient.paymentEvidenceUrl || "";
    let evidenceName = patient.paymentEvidenceName || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const statusVal = formData.get("status")?.toString() || "pending";
      isPaid = statusVal === "paid" || formData.get("isPaid") === "true";
      amount = formData.get("amount")?.toString()?.trim() || "";
      method = formData.get("method")?.toString()?.trim() || "";
      reference = formData.get("reference")?.toString()?.trim() || "";
      notes = formData.get("notes")?.toString()?.trim() || "";
      removeEvidence = formData.get("removeEvidence") === "true";

      const file = formData.get("evidence");
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          return NextResponse.json({ error: "Evidence file exceeds 10MB limit" }, { status: 413 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const signature = detectFileSignature(buffer);
        if (!signature) {
          return NextResponse.json(
            { error: "Invalid file type. Only PNG, JPG, WEBP, and PDF files are allowed" },
            { status: 415 },
          );
        }

        evidenceName = file.name.slice(0, 150);

        if (process.env.BLOB_READ_WRITE_TOKEN) {
          const blobPath = `payment-evidence/${id}/${crypto.randomUUID()}.${signature.ext}`;
          const blob = await put(blobPath, buffer, {
            access: "public",
            contentType: signature.mimeType,
          });
          evidenceUrl = blob.url;
        } else {
          // Local/non-blob fallback: save to public/uploads/payment-evidence or inline data URI
          try {
            const uploadDir = path.join(process.cwd(), "public", "uploads", "payment-evidence");
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            const fileName = `${id}-${Date.now()}.${signature.ext}`;
            const filePath = path.join(uploadDir, fileName);
            fs.writeFileSync(filePath, buffer);
            evidenceUrl = `/uploads/payment-evidence/${fileName}`;
          } catch {
            // In environments where filesystem is read-only, store as base64 data URI
            evidenceUrl = `data:${signature.mimeType};base64,${buffer.toString("base64")}`;
          }
        }
      }
    } else {
      const json = await req.json();
      isPaid = json.status === "paid" || json.isPaid === true;
      amount = json.amount?.toString()?.trim() || "";
      method = json.method?.toString()?.trim() || "";
      reference = json.reference?.toString()?.trim() || "";
      notes = json.notes?.toString()?.trim() || "";
      removeEvidence = Boolean(json.removeEvidence);

      if (json.evidenceUrl) {
        evidenceUrl = json.evidenceUrl;
        evidenceName = json.evidenceName || "payment-proof.png";
      }
    }

    if (removeEvidence) {
      evidenceUrl = "";
      evidenceName = "";
    }

    const cashierName = session.user.name || session.user.email || "Cashier";
    const paymentStatus = isPaid ? "paid" : "pending";
    const paymentConfirmedAt = isPaid ? new Date() : null;
    const paymentConfirmedBy = isPaid ? cashierName : "";

    const [updated] = await db
      .update(patients)
      .set({
        paymentStatus,
        paymentConfirmedAt,
        paymentConfirmedBy,
        paymentAmount: amount,
        paymentMethod: method,
        paymentReference: reference,
        paymentEvidenceUrl: evidenceUrl,
        paymentEvidenceName: evidenceName,
        paymentNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, id))
      .returning();

    // Log the audit event for compliance
    await logEvent({
      category: "records",
      action: isPaid ? "patient.payment_confirmed" : "patient.payment_reverted",
      targetType: "patient",
      targetId: id,
      actorId: session.user.id,
      actorRoleAtTime: (session.user as { role?: "admin" | "super_admin" }).role || "admin",
      actorLabel: cashierName,
      summary: isPaid
        ? `Confirmed hospital fee payment${amount ? ` of ₦${amount}` : ""} for patient ${patient.firstNames} ${patient.surname} (${patient.hospitalNumber}) via ${method || "Cashier"}`
        : `Reverted payment status to pending for patient ${patient.firstNames} ${patient.surname} (${patient.hospitalNumber})`,
      metadata: {
        patientId: id,
        hospitalNumber: patient.hospitalNumber,
        isPaid,
        amount,
        method,
        reference,
        hasEvidence: Boolean(evidenceUrl),
        cashier: cashierName,
      },
    });

    return NextResponse.json({
      success: true,
      patient: updated,
    });
  } catch (err) {
    console.error("Failed to update patient payment:", err);
    return NextResponse.json({ error: "Failed to update payment status" }, { status: 500 });
  }
}
