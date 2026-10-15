"use server";

import { eq, ilike, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { formRecords, patients } from "@/db/schema";
import { requireStaff, requireSuperAdmin } from "@/lib/authz";
import { logEvent, type ActorRole } from "@/lib/activity";
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
  await requireStaff();
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

  return rows
    .filter(
      (r) => !r.hospitalNumber.startsWith("DRAFT-") || r.hospitalNumber.toLowerCase().includes(q.toLowerCase()),
    )
    .map((r) => ({
      id: r.id,
      surname: r.surname,
      firstNames: r.firstNames,
      age: r.age ?? "",
      sex: r.sex ?? "",
      phone: r.phone ?? "",
      address: r.address ?? "",
      hospitalNumber: r.hospitalNumber,
    }));
}

export async function upsertPatientForForm(
  patientId: string | null,
  input: PatientInput,
): Promise<{ patientId: string }> {
  await requireStaff();
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

/** Super-admin-only bulk delete, used by the Patients page's multi-select action bar. */
export async function bulkDeletePatients(patientIds: string[]): Promise<{ count: number }> {
  const session = await requireSuperAdmin();
  if (!patientIds || patientIds.length === 0) return { count: 0 };

  const rows = await db
    .select({ id: patients.id, surname: patients.surname, firstNames: patients.firstNames, hospitalNumber: patients.hospitalNumber })
    .from(patients)
    .where(inArray(patients.id, patientIds));
  if (rows.length === 0) return { count: 0 };

  const actorLabel = session.user.name;
  const actorRole = (session.user as { role?: ActorRole }).role ?? null;

  await db.transaction(async (tx) => {
    await tx.delete(formRecords).where(inArray(formRecords.patientId, patientIds));
    await tx.delete(patients).where(inArray(patients.id, patientIds));

    for (const row of rows) {
      await logEvent({
        tx,
        category: "records",
        action: "patient.deleted",
        summary: `${actorLabel} deleted patient file ${row.firstNames} ${row.surname} (${row.hospitalNumber}) (bulk action)`,
        actorId: session.user.id,
        actorRoleAtTime: actorRole,
        actorLabel,
        targetType: "patient",
        targetId: row.id,
        metadata: { bulk: true, bulkCount: rows.length },
      });
    }
  });

  revalidatePath("/patients");
  revalidatePath("/dashboard");
  return { count: rows.length };
}

export async function createDraftPatient(): Promise<{ patientId: string; hospitalNumber: string }> {
  await requireStaff();
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
