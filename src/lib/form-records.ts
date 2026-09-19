import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { formRecords, patients } from "@/db/schema";
import type { FormType } from "@/lib/validators/form-data";

/** Form records of a given type, newest first, joined with patient identity. */
export async function listFormRecords(type: FormType, limit?: number) {
  const query = db
    .select({
      id: formRecords.id,
      status: formRecords.status,
      updatedAt: formRecords.updatedAt,
      surname: patients.surname,
      firstNames: patients.firstNames,
      hospitalNumber: patients.hospitalNumber,
    })
    .from(formRecords)
    .innerJoin(patients, eq(formRecords.patientId, patients.id))
    .where(eq(formRecords.type, type))
    .orderBy(desc(formRecords.updatedAt));

  return limit ? query.limit(limit) : query;
}
