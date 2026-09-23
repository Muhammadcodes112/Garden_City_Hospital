"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, formRecords, patients } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import {
  defaultPrescriptionData,
  prescriptionCompleteSchema,
  prescriptionDataSchema,
  type PrescriptionData,
} from "@/lib/validators/prescription";
import { draftPatientSchema, patientSchema, type PatientInput } from "@/lib/validators/patient";
import { createDraftPatient } from "@/lib/actions/patients";
import { buildSearchText } from "@/lib/search";

export type PrescriptionFormBundle = {
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
  data: PrescriptionData;
};

export async function createPrescriptionDraftRecord(): Promise<{ recordId: string }> {
  const session = await requireAdmin();
  const { patientId } = await createDraftPatient();
  const data = defaultPrescriptionData();
  const patientRow = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
  const searchText = patientRow[0] ? buildSearchText(patientRow[0], data, "prescription") : "";

  const [record] = await db
    .insert(formRecords)
    .values({
      type: "prescription",
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

export async function getPrescriptionFormRecord(
  recordId: string,
): Promise<PrescriptionFormBundle | null> {
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
    .where(and(eq(formRecords.id, recordId), eq(formRecords.type, "prescription")))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    recordId: row.recordId,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    data: prescriptionDataSchema.parse(row.data),
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

export type SavePrescriptionFormInput = {
  recordId: string;
  patient: PatientInput & { id: string };
  data: PrescriptionData;
};

export async function savePrescriptionForm(
  input: SavePrescriptionFormInput,
): Promise<{ updatedAt: string }> {
  const session = await requireAdmin();
  const patientParsed = draftPatientSchema.parse(input.patient);
  const dataParsed = prescriptionDataSchema.parse(input.data);

  const existing = await getPrescriptionFormRecord(input.recordId);
  if (!existing) throw new Error("Prescription form not found");
  if (existing.status === "completed") throw new Error("Completed forms cannot be edited");

  await db
    .update(patients)
    .set({ ...patientParsed, updatedAt: new Date() })
    .where(eq(patients.id, input.patient.id));

  const searchText = buildSearchText(patientParsed, dataParsed, "prescription");

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

export async function completePrescriptionForm(
  input: SavePrescriptionFormInput,
): Promise<{ success: true; updatedAt: string } | { success: false; error: string }> {
  try {
    const session = await requireAdmin();

    const patientResult = patientSchema.safeParse(input.patient);
    if (!patientResult.success) {
      const issue = patientResult.error.issues[0];
      const msg = issue ? `${issue.message}` : "Please fill in all required patient info";
      return { success: false, error: `Patient Info Required: ${msg}` };
    }

    const dataResult = prescriptionCompleteSchema.safeParse(input.data);
    if (!dataResult.success) {
      const issue = dataResult.error.issues[0];
      const msg = issue ? `${issue.message}` : "Please fill in required drug items and prescriber name";
      return { success: false, error: `Prescription Incomplete: ${msg}` };
    }

    const patientParsed = patientResult.data;
    const dataParsed = dataResult.data;

    const existing = await getPrescriptionFormRecord(input.recordId);
    if (!existing) return { success: false, error: "Prescription form not found" };
    if (existing.status === "completed") return { success: false, error: "Form is already completed" };

    await db
      .update(patients)
      .set({ ...patientParsed, updatedAt: new Date() })
      .where(eq(patients.id, input.patient.id));

    const searchText = buildSearchText(patientParsed, dataParsed, "prescription");
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

    return { success: true, updatedAt: updated!.updatedAt.toISOString() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to mark as completed";
    return { success: false, error: msg };
  }
}

const COMMON_DRUGS = [
  "Paracetamol",
  "Amoxicillin",
  "Artemether / Lumefantrine (Coartem)",
  "Ciprofloxacin",
  "Metronidazole (Flagyl)",
  "Ibuprofen",
  "Omeprazole",
  "Azithromycin",
  "Cefuroxime",
  "Augmentin (Amoxicillin/Clavulanate)",
  "Tramadol",
  "Diclofenac Sodium",
  "Cetirizine",
  "Loperamide",
  "Prednisolone",
  "Hyoscine Butylbromide (Buscopan)",
  "Vitamin C",
  "Multivitamin",
  "Folic Acid",
  "Ferrous Sulphate",
];

export async function getDrugAutocompleteSuggestions(query: string): Promise<string[]> {
  await requireAdmin();
  const q = query.trim().toLowerCase();
  if (!q) return COMMON_DRUGS.slice(0, 10);

  const rows = await db
    .select({ data: formRecords.data })
    .from(formRecords)
    .where(eq(formRecords.type, "prescription"))
    .limit(50);

  const set = new Set<string>();
  for (const row of rows) {
    const data = row.data as { items?: { drugName?: string }[] };
    if (Array.isArray(data?.items)) {
      for (const item of data.items) {
        if (item.drugName && item.drugName.toLowerCase().includes(q)) {
          set.add(item.drugName.trim());
        }
      }
    }
  }

  for (const d of COMMON_DRUGS) {
    if (d.toLowerCase().includes(q)) {
      set.add(d);
    }
  }

  return Array.from(set).slice(0, 15);
}
