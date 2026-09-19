"use server";

import { and, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, formRecords, patients, shareLinks } from "@/db/schema";
import { requireAdmin, requireAdminApi } from "@/lib/session";
import { labRequestDataSchema } from "@/lib/validators/lab-request";
import { prescriptionDataSchema } from "@/lib/validators/prescription";
import { medicalReportDataSchema } from "@/lib/validators/medical-report";
import { labRequestPdfFilename, labRequestPdfHtml } from "@/lib/pdf-templates/lab-request";
import { prescriptionPdfFilename, prescriptionPdfHtml } from "@/lib/pdf-templates/prescription";
import { medicalReportPdfFilename, medicalReportPdfHtml } from "@/lib/pdf-templates/medical-report";

export type ShareLinkItem = {
  id: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

export async function createShareLink(input: {
  formRecordId: string;
  expiryDays: 1 | 7 | 30;
  origin?: string;
}): Promise<{ id: string; token: string; url: string; expiresAt: string }> {
  const session = await requireAdmin();

  // Verify form record exists
  const [form] = await db
    .select({ id: formRecords.id })
    .from(formRecords)
    .where(eq(formRecords.id, input.formRecordId))
    .limit(1);

  if (!form) throw new Error("Form record not found");

  const token =
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "").slice(0, 8);

  const expiresAt = new Date(Date.now() + input.expiryDays * 24 * 60 * 60 * 1000);

  const [link] = await db
    .insert(shareLinks)
    .values({
      formRecordId: input.formRecordId,
      token,
      expiresAt,
      createdBy: session.user.id,
    })
    .returning({ id: shareLinks.id, token: shareLinks.token, expiresAt: shareLinks.expiresAt });

  await db.insert(activityLogs).values({
    userId: session.user.id,
    formRecordId: input.formRecordId,
    action: "shared",
  });

  const baseUrl = input.origin || process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const url = `${baseUrl}/s/${token}`;

  return {
    id: link!.id,
    token: link!.token,
    url,
    expiresAt: link!.expiresAt.toISOString(),
  };
}

export async function getActiveShareLinks(formRecordId: string): Promise<ShareLinkItem[]> {
  await requireAdmin();
  const rows = await db
    .select({
      id: shareLinks.id,
      token: shareLinks.token,
      expiresAt: shareLinks.expiresAt,
      createdAt: shareLinks.createdAt,
    })
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.formRecordId, formRecordId),
        isNull(shareLinks.revokedAt),
        gte(shareLinks.expiresAt, new Date()),
      ),
    );

  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function revokeShareLink(shareLinkId: string): Promise<{ success: boolean }> {
  const session = await requireAdmin();

  const [link] = await db
    .select({ id: shareLinks.id, formRecordId: shareLinks.formRecordId })
    .from(shareLinks)
    .where(eq(shareLinks.id, shareLinkId))
    .limit(1);

  if (!link) throw new Error("Share link not found");

  await db
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(eq(shareLinks.id, shareLinkId));

  await db.insert(activityLogs).values({
    userId: session.user.id,
    formRecordId: link.formRecordId,
    action: "link_revoked",
  });

  return { success: true };
}

export async function reopenFormRecord(formRecordId: string): Promise<{ success: boolean }> {
  const session = await requireAdmin();

  const [form] = await db
    .select({ id: formRecords.id, status: formRecords.status })
    .from(formRecords)
    .where(eq(formRecords.id, formRecordId))
    .limit(1);

  if (!form) throw new Error("Form record not found");
  if (form.status !== "completed") throw new Error("Form is not completed");

  await db
    .update(formRecords)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(formRecords.id, formRecordId));

  await db.insert(activityLogs).values({
    userId: session.user.id,
    formRecordId,
    action: "reopened",
  });

  return { success: true };
}

export async function logFormDownload(formRecordId: string): Promise<void> {
  const session = await requireAdminApi();
  if (!session) return;

  await db.insert(activityLogs).values({
    userId: session.user.id,
    formRecordId,
    action: "downloaded",
  });
}

export async function getPublicShareData(token: string): Promise<{
  valid: boolean;
  html?: string;
  filename?: string;
  recordId?: string;
  formType?: string;
  expiresAt?: string;
}> {
  const rows = await db
    .select({
      id: shareLinks.id,
      expiresAt: shareLinks.expiresAt,
      revokedAt: shareLinks.revokedAt,
      formRecordId: shareLinks.formRecordId,
    })
    .from(shareLinks)
    .where(eq(shareLinks.token, token))
    .limit(1);

  const link = rows[0];
  if (!link || link.revokedAt !== null || link.expiresAt < new Date()) {
    return { valid: false };
  }

  const formRows = await db
    .select({
      id: formRecords.id,
      type: formRecords.type,
      status: formRecords.status,
      data: formRecords.data,
      surname: patients.surname,
      firstNames: patients.firstNames,
      age: patients.age,
      sex: patients.sex,
      address: patients.address,
      hospitalNumber: patients.hospitalNumber,
    })
    .from(formRecords)
    .innerJoin(patients, eq(formRecords.patientId, patients.id))
    .where(eq(formRecords.id, link.formRecordId))
    .limit(1);

  const form = formRows[0];
  if (!form) return { valid: false };

  const patientObj = {
    surname: form.surname,
    firstNames: form.firstNames,
    age: form.age ?? "",
    sex: form.sex ?? "",
    address: form.address ?? "",
    hospitalNumber: form.hospitalNumber ?? "",
  };

  let html = "";
  let filename = "";

  if (form.type === "lab") {
    const data = labRequestDataSchema.parse(form.data);
    html = labRequestPdfHtml({
      patient: patientObj,
      data,
      isDraft: form.status === "draft",
    });
    filename = labRequestPdfFilename(patientObj, data.formDate);
  } else if (form.type === "prescription") {
    const data = prescriptionDataSchema.parse(form.data);
    html = prescriptionPdfHtml({
      patient: patientObj,
      data,
      isDraft: form.status === "draft",
    });
    filename = prescriptionPdfFilename(patientObj, data.prescriberDate);
  } else if (form.type === "medical_report") {
    const data = medicalReportDataSchema.parse(form.data);
    html = medicalReportPdfHtml({
      patient: patientObj,
      data,
      isDraft: form.status === "draft",
    });
    filename = medicalReportPdfFilename(patientObj, data.reportDate);
  }

  return {
    valid: true,
    html,
    filename,
    recordId: form.id,
    formType: form.type,
    expiresAt: link.expiresAt.toISOString(),
  };
}
