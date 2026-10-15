import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, formRecords, messageAttachments, patients, shareLinks } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Hard-deletes patients and their form records, first clearing every FK that
 * points at them (all ON DELETE NO ACTION). Message attachments and legacy
 * activity_logs keep their rows with the reference nulled — the attachment
 * card then renders as "no longer available" rather than the message vanishing.
 */
export async function deletePatientsCascade(tx: Tx, patientIds: string[]): Promise<void> {
  if (patientIds.length === 0) return;

  const recordIds = (
    await tx.select({ id: formRecords.id }).from(formRecords).where(inArray(formRecords.patientId, patientIds))
  ).map((r) => r.id);

  if (recordIds.length > 0) {
    const linkIds = (
      await tx.select({ id: shareLinks.id }).from(shareLinks).where(inArray(shareLinks.formRecordId, recordIds))
    ).map((r) => r.id);

    if (linkIds.length > 0) {
      await tx.update(messageAttachments).set({ shareLinkId: null }).where(inArray(messageAttachments.shareLinkId, linkIds));
      await tx.delete(shareLinks).where(inArray(shareLinks.id, linkIds));
    }
    await tx.update(messageAttachments).set({ formRecordId: null }).where(inArray(messageAttachments.formRecordId, recordIds));
    await tx.update(activityLogs).set({ formRecordId: null }).where(inArray(activityLogs.formRecordId, recordIds));
    await tx.delete(formRecords).where(inArray(formRecords.id, recordIds));
  }

  await tx.update(messageAttachments).set({ patientId: null }).where(inArray(messageAttachments.patientId, patientIds));
  await tx.delete(patients).where(inArray(patients.id, patientIds));
}
