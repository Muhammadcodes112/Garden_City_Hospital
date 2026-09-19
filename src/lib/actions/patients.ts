"use server";

import { eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { patientSchema, type PatientInput } from "@/lib/validators/patient";

export type PatientRow = {
  id: string;
  surname: string;
  firstNames: string;
  age: string;
  sex: string;
  phone: string;
  address: string;
  hospitalNumber: string;
};

export async function searchPatients(query: string): Promise<PatientRow[]> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return [];

  const pattern = `%${q}%`;
  const rows = await db
    .select()
    .from(patients)
    .where(
      or(
        ilike(patients.surname, pattern),
        ilike(patients.firstNames, pattern),
        ilike(patients.hospitalNumber, pattern),
      ),
    )
    .limit(30);

  return rows.filter(
    (r) => !r.hospitalNumber.startsWith("DRAFT-") || r.hospitalNumber.toLowerCase().includes(q.toLowerCase()),
  );
}

export async function upsertPatientForForm(
  patientId: string | null,
  input: PatientInput,
): Promise<{ patientId: string }> {
  await requireAdmin();
  const parsed = patientSchema.parse(input);

  if (patientId) {
    await db
      .update(patients)
      .set({
        ...parsed,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, patientId));
    return { patientId };
  }

  const [row] = await db
    .insert(patients)
    .values({
      ...parsed,
    })
    .returning({ id: patients.id });
  return { patientId: row!.id };
}

export async function createDraftPatient(): Promise<{ patientId: string; hospitalNumber: string }> {
  await requireAdmin();
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const hospitalNumber = `DRAFT-${suffix}`;
  const [row] = await db
    .insert(patients)
    .values({
      surname: "",
      firstNames: "",
      age: "",
      sex: "",
      phone: "",
      address: "",
      hospitalNumber,
    })
    .returning({ id: patients.id, hospitalNumber: patients.hospitalNumber });
  return { patientId: row!.id, hospitalNumber: row!.hospitalNumber };
}
