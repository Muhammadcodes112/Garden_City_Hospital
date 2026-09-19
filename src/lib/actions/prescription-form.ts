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

  const [record] = await db
    .insert(formRecords)
    .values({
      type: "prescription",
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

export async function completePrescriptionForm(
  input: SavePrescriptionFormInput,
): Promise<{ updatedAt: string }> {
  const session = await requireAdmin();
  const patientParsed = patientSchema.parse(input.patient);
  const dataParsed = prescriptionCompleteSchema.parse(input.data);

  const existing = await getPrescriptionFormRecord(input.recordId);
  if (!existing) throw new Error("Prescription form not found");
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
