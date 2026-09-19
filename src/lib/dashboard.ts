import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { formRecords, patients } from "@/db/schema";

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Monday 00:00 UTC for the week containing `date`. */
function startOfUtcWeek(date = new Date()) {
  const day = date.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  const start = startOfUtcDay(date);
  start.setUTCDate(start.getUTCDate() - daysFromMonday);
  return start;
}

export type DashboardStats = {
  formsCreatedToday: number;
  draftsInProgress: number;
  completedThisWeek: number;
  totalPatients: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const todayStart = startOfUtcDay();
  const weekStart = startOfUtcWeek();

  const [[formsToday], [drafts], [completedWeek], [patientTotal]] = await Promise.all([
    db
      .select({ value: count() })
      .from(formRecords)
      .where(gte(formRecords.createdAt, todayStart)),
    db.select({ value: count() }).from(formRecords).where(eq(formRecords.status, "draft")),
    db
      .select({ value: count() })
      .from(formRecords)
      .where(
        and(
          eq(formRecords.status, "completed"),
          gte(sql`coalesce(${formRecords.completedAt}, ${formRecords.updatedAt})`, weekStart.toISOString()),
        ),
      ),
    db.select({ value: count() }).from(patients),
  ]);

  return {
    formsCreatedToday: formsToday?.value ?? 0,
    draftsInProgress: drafts?.value ?? 0,
    completedThisWeek: completedWeek?.value ?? 0,
    totalPatients: patientTotal?.value ?? 0,
  };
}

export type RecentFormRow = {
  id: string;
  type: "lab" | "prescription" | "medical_report";
  status: "draft" | "completed";
  updatedAt: Date;
  surname: string;
  firstNames: string;
  hospitalNumber: string;
};

export async function listRecentFormRecords(limit = 50): Promise<RecentFormRow[]> {
  return db
    .select({
      id: formRecords.id,
      type: formRecords.type,
      status: formRecords.status,
      updatedAt: formRecords.updatedAt,
      surname: patients.surname,
      firstNames: patients.firstNames,
      hospitalNumber: patients.hospitalNumber,
    })
    .from(formRecords)
    .innerJoin(patients, eq(formRecords.patientId, patients.id))
    .orderBy(desc(formRecords.updatedAt))
    .limit(limit);
}
