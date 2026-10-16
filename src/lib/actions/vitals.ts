"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { patients, patientVitals } from "@/db/schema";
import { requireStaff } from "@/lib/authz";
import { logEvent, type ActorRole } from "@/lib/activity";
import { recordVitalsSchema, type RecordVitalsInput } from "@/lib/validators/vitals";

export async function recordVitals(
  input: RecordVitalsInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireStaff();
  const parsed = recordVitalsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid vitals" };
  const v = parsed.data;

  const [patient] = await db
    .select({ surname: patients.surname, firstNames: patients.firstNames, hospitalNumber: patients.hospitalNumber })
    .from(patients)
    .where(eq(patients.id, v.patientId));
  if (!patient) return { success: false, error: "Patient not found" };

  const actorLabel = session.user.name;
  const actorRole = (session.user as { role?: ActorRole }).role ?? null;
  const reading = [
    v.bloodPressure && `BP ${v.bloodPressure}`,
    v.pulse !== undefined && `pulse ${v.pulse}`,
    v.temperature && `temp ${v.temperature}°C`,
    v.spo2 !== undefined && `SpO2 ${v.spo2}%`,
  ]
    .filter(Boolean)
    .join(", ");

  await db.transaction(async (tx) => {
    await tx.insert(patientVitals).values({
      patientId: v.patientId,
      bloodPressure: v.bloodPressure || null,
      pulse: v.pulse ?? null,
      temperature: v.temperature || null,
      spo2: v.spo2 ?? null,
      notes: v.notes || null,
      recordedBy: session.user.id,
      recordedByName: actorLabel,
    });
    await logEvent({
      tx,
      category: "records",
      action: "patient.vitals_recorded",
      summary: `${actorLabel} recorded vitals for ${patient.firstNames} ${patient.surname} (${patient.hospitalNumber}): ${reading}`,
      actorId: session.user.id,
      actorRoleAtTime: actorRole,
      actorLabel,
      targetType: "patient",
      targetId: v.patientId,
    });
  });

  return { success: true };
}
