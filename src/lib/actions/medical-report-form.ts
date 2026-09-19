"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, formRecords, patients } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import {
  defaultMedicalReportData,
  medicalReportCompleteSchema,
  medicalReportDataSchema,
  type MedicalReportData,
} from "@/lib/validators/medical-report";
import { draftPatientSchema, patientSchema, type PatientInput } from "@/lib/validators/patient";
import { createDraftPatient } from "@/lib/actions/patients";

export type MedicalReportFormBundle = {
  recordId: string;
  status: "draft" | "completed";
  updatedAt: string;
  patient: {
    id: string;
    surname: string;
    firstNames: string;
    age: string;
    sex: string;
    phone: string;
    address: string;
    hospitalNumber: string;
  };
  data: MedicalReportData;
};

async function generateRefNo(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const rows = await db
    .select({ id: formRecords.id })
    .from(formRecords)
    .where(eq(formRecords.type, "medical_report"));

  const seq = (rows.length + 1).toString().padStart(4, "0");
  return `GCSH/MR/${currentYear}/${seq}`;
}

export async function createMedicalReportDraftRecord(): Promise<{ recordId: string }> {
  const session = await requireAdmin();
  const { patientId } = await createDraftPatient();
  const refNo = await generateRefNo();
  const data = defaultMedicalReportData(refNo);

  const [record] = await db
    .insert(formRecords)
    .values({
      type: "medical_report",
      patientId,
      status: "draft",
      data,
      createdBy: session.user.id,
    })
    .returning({ id: formRecords.id });

  await db.insert(activityLogs).values({
    userId: session.user.id,
    formRecordId: record!.id,
    action: "created",
  });

  return { recordId: record!.id };
}

export async function getMedicalReportFormRecord(
  recordId: string,
): Promise<MedicalReportFormBundle | null> {
  await requireAdmin();
  const rows = await db
    .select({
      recordId: formRecords.id,
      status: formRecords.status,
      updatedAt: formRecords.updatedAt,
      data: formRecords.data,
      patientId: patients.id,
      surname: patients.surname,
      firstNames: patients.firstNames,
      age: patients.age,
      sex: patients.sex,
      phone: patients.phone,
      address: patients.address,
      hospitalNumber: patients.hospitalNumber,
    })
    .from(formRecords)
    .innerJoin(patients, eq(formRecords.patientId, patients.id))
    .where(and(eq(formRecords.id, recordId), eq(formRecords.type, "medical_report")))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    recordId: row.recordId,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    data: medicalReportDataSchema.parse(row.data),
    patient: {
      id: row.patientId,
      surname: row.surname,
      firstNames: row.firstNames,
      age: row.age ?? "",
      sex: row.sex ?? "",
      phone: row.phone ?? "",
      address: row.address ?? "",
      hospitalNumber: row.hospitalNumber,
    },
  };
}

export type SaveMedicalReportFormInput = {
  recordId: string;
  patient: PatientInput & { id: string };
  data: MedicalReportData;
};

export async function saveMedicalReportForm(
  input: SaveMedicalReportFormInput,
): Promise<{ updatedAt: string }> {
  const session = await requireAdmin();
  const patientParsed = draftPatientSchema.parse(input.patient);
  const dataParsed = medicalReportDataSchema.parse(input.data);

  const existing = await getMedicalReportFormRecord(input.recordId);
  if (!existing) throw new Error("Medical report not found");
  if (existing.status === "completed") throw new Error("Completed reports cannot be edited");

  await db
    .update(patients)
    .set({ ...patientParsed, updatedAt: new Date() })
    .where(eq(patients.id, input.patient.id));

  const [updated] = await db
    .update(formRecords)
    .set({
      data: dataParsed,
      updatedAt: new Date(),
    })
    .where(eq(formRecords.id, input.recordId))
    .returning({ updatedAt: formRecords.updatedAt });

  void session;
  return { updatedAt: updated!.updatedAt.toISOString() };
}

export async function completeMedicalReportForm(
  input: SaveMedicalReportFormInput,
): Promise<{ updatedAt: string }> {
  const session = await requireAdmin();
  const patientParsed = patientSchema.parse(input.patient);
  const dataParsed = medicalReportCompleteSchema.parse(input.data);

  const existing = await getMedicalReportFormRecord(input.recordId);
  if (!existing) throw new Error("Medical report not found");
  if (existing.status === "completed") throw new Error("Already completed");

  await db
    .update(patients)
    .set({ ...patientParsed, updatedAt: new Date() })
    .where(eq(patients.id, input.patient.id));

  const now = new Date();
  const [updated] = await db
    .update(formRecords)
    .set({
      data: dataParsed,
      status: "completed",
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(formRecords.id, input.recordId))
    .returning({ updatedAt: formRecords.updatedAt });

  await db.insert(activityLogs).values({
    userId: session.user.id,
    formRecordId: input.recordId,
    action: "completed",
  });

  return { updatedAt: updated!.updatedAt.toISOString() };
}
