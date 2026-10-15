"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { formRecords, medicationAdministrations } from "@/db/schema";
import { requireStaff } from "@/lib/authz";
import { logEvent, type ActorRole } from "@/lib/activity";
import { prescriptionDataSchema } from "@/lib/validators/prescription";
import { doseItemKey, recordDoseSchema, type DoseSlot, type RecordDoseInput } from "@/lib/validators/medication-chart";

export type DoseEntry = {
  itemId: string;
  slot: DoseSlot;
  given: boolean;
  reason: string | null;
  recordedByName: string;
  recordedAt: string;
};

export async function getDoseEntries(formRecordId: string, date: string): Promise<DoseEntry[]> {
  await requireStaff();
  const rows = await db
    .select()
    .from(medicationAdministrations)
    .where(and(eq(medicationAdministrations.formRecordId, formRecordId), eq(medicationAdministrations.date, date)));
  return rows.map((r) => ({
    itemId: r.itemId,
    slot: r.slot as DoseSlot,
    given: r.given,
    reason: r.reason,
    recordedByName: r.recordedByName,
    recordedAt: r.recordedAt.toISOString(),
  }));
}

export async function recordDose(
  input: RecordDoseInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireStaff();
  const parsed = recordDoseSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid entry" };
  const { formRecordId, itemId, date, slot, given } = parsed.data;
  const reason = given ? null : parsed.data.reason!;

  const [record] = await db
    .select({ type: formRecords.type, data: formRecords.data, deletedAt: formRecords.deletedAt })
    .from(formRecords)
    .where(eq(formRecords.id, formRecordId));
  if (!record || record.type !== "prescription" || record.deletedAt) {
    return { success: false, error: "Prescription not found" };
  }
  const items = prescriptionDataSchema.parse(record.data).items;
  const index = items.findIndex((item, i) => doseItemKey(item, i) === itemId);
  if (index === -1) return { success: false, error: "Medication is no longer on this prescription" };
  const item = items[index]!;
  const drugLabel = [item.drugName, item.strength].filter(Boolean).join(" ") || "Unnamed medication";

  const actorLabel = session.user.name;
  const actorRole = (session.user as { role?: ActorRole }).role ?? null;
  const values = { given, reason, drugLabel, recordedBy: session.user.id, recordedByName: actorLabel, recordedAt: new Date() };

  await db.transaction(async (tx) => {
    await tx
      .insert(medicationAdministrations)
      .values({ formRecordId, itemId, date, slot, ...values })
      .onConflictDoUpdate({
        target: [
          medicationAdministrations.formRecordId,
          medicationAdministrations.itemId,
          medicationAdministrations.date,
          medicationAdministrations.slot,
        ],
        set: values,
      });

    await logEvent({
      tx,
      category: "records",
      action: given ? "medication.given" : "medication.not_given",
      summary: given
        ? `${actorLabel} charted ${drugLabel} as given (${slot}, ${date})`
        : `${actorLabel} charted ${drugLabel} as NOT given (${slot}, ${date}): ${reason}`,
      actorId: session.user.id,
      actorRoleAtTime: actorRole,
      actorLabel,
      targetType: "form_record",
      targetId: formRecordId,
      metadata: { itemId, date, slot, given, reason },
    });
  });

  return { success: true };
}

/** Undo a mistaken entry so the dose shows as not yet charted again. */
export async function clearDose(input: { formRecordId: string; itemId: string; date: string; slot: DoseSlot }): Promise<void> {
  const session = await requireStaff();
  const { formRecordId, itemId, date, slot } = input;
  const actorLabel = session.user.name;
  const actorRole = (session.user as { role?: ActorRole }).role ?? null;

  await db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(medicationAdministrations)
      .where(
        and(
          eq(medicationAdministrations.formRecordId, formRecordId),
          eq(medicationAdministrations.itemId, itemId),
          eq(medicationAdministrations.date, date),
          eq(medicationAdministrations.slot, slot),
        ),
      )
      .returning({ drugLabel: medicationAdministrations.drugLabel, given: medicationAdministrations.given });
    if (!removed) return;

    await logEvent({
      tx,
      category: "records",
      action: "medication.cleared",
      summary: `${actorLabel} cleared the ${slot} entry for ${removed.drugLabel} on ${date} (was ${removed.given ? "given" : "not given"})`,
      actorId: session.user.id,
      actorRoleAtTime: actorRole,
      actorLabel,
      targetType: "form_record",
      targetId: formRecordId,
      metadata: { itemId, date, slot },
    });
  });
}
