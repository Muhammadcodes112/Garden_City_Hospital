"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, formRecords, patients } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import {
  defaultLabRequestData,
  labRequestCompleteSchema,
  labRequestDataSchema,
  type LabRequestData,
} from "@/lib/validators/lab-request";
import { draftPatientSchema, patientSchema, type PatientInput } from "@/lib/validators/patient";
import { createDraftPatient } from "@/lib/actions/patients";
import { buildSearchText } from "@/lib/search";

export type LabFormBundle = {
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
  data: LabRequestData;
};

export async function createLabDraftRecord(): Promise<{ recordId: string }> {
  const session = await requireAdmin();
  const { patientId } = await createDraftPatient();
  const data = defaultLabRequestData();
  const patientRow = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
  const searchText = patientRow[0] ? buildSearchText(patientRow[0], data, "lab") : "";

  const [record] = await db
    .insert(formRecords)
    .values({
      type: "lab",
      patientId,
      status: "draft",
      data,
      searchText,
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

export async function getLabFormRecord(recordId: string): Promise<LabFormBundle | null> {
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
    .where(and(eq(formRecords.id, recordId), eq(formRecords.type, "lab")))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    recordId: row.recordId,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    data: labRequestDataSchema.parse(row.data),
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

export type SaveLabFormInput = {
  recordId: string;
  patient: PatientInput & { id: string };
  data: LabRequestData;
  clientUpdatedAt?: string;
};

export async function saveLabForm(input: SaveLabFormInput): Promise<{ updatedAt: string }> {
  const session = await requireAdmin();
  const patientParsed = draftPatientSchema.parse(input.patient);
  const dataParsed = labRequestDataSchema.parse(input.data);

  const existing = await getLabFormRecord(input.recordId);
  if (!existing) throw new Error("Form not found");
  if (existing.status === "completed") throw new Error("Completed forms cannot be edited");

  await db
    .update(patients)
    .set({ ...patientParsed, updatedAt: new Date() })
    .where(eq(patients.id, input.patient.id));

  const searchText = buildSearchText(patientParsed, dataParsed, "lab");

  const [updated] = await db
    .update(formRecords)
    .set({
      data: dataParsed,
      searchText,
      updatedAt: new Date(),
    })
    .where(eq(formRecords.id, input.recordId))
    .returning({ updatedAt: formRecords.updatedAt });

  void session;
  return { updatedAt: updated!.updatedAt.toISOString() };
}

export async function completeLabForm(input: SaveLabFormInput): Promise<{ updatedAt: string }> {
  const session = await requireAdmin();
  const patientParsed = patientSchema.parse(input.patient);
  const dataParsed = labRequestCompleteSchema.parse(input.data);

  const existing = await getLabFormRecord(input.recordId);
  if (!existing) throw new Error("Form not found");
  if (existing.status === "completed") throw new Error("Already completed");

  await db
    .update(patients)
    .set({ ...patientParsed, updatedAt: new Date() })
    .where(eq(patients.id, input.patient.id));

  const searchText = buildSearchText(patientParsed, dataParsed, "lab");
  const now = new Date();
  const [updated] = await db
    .update(formRecords)
    .set({
      data: dataParsed,
      status: "completed",
      searchText,
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
