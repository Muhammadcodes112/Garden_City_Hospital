"use server";

import { and, inArray, eq } from "drizzle-orm";
import { db } from "@/db";
import { formRecords, shareLinks } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/authz";
import { logEvent, type ActorRole } from "@/lib/activity";
import { revalidatePath } from "next/cache";

export async function softDeleteRecord(recordId: string) {
  const session = await requireSuperAdmin();
  const now = new Date();
  const actorLabel = session.user.name;
  const actorRole = (session.user as { role?: ActorRole }).role ?? null;

  await db.transaction(async (tx) => {
    await tx
      .update(formRecords)
      .set({ deletedAt: now, deletedBy: session.user.id })
      .where(eq(formRecords.id, recordId));

    await tx
      .update(shareLinks)
      .set({ revokedAt: now })
      .where(and(eq(shareLinks.formRecordId, recordId), eq(shareLinks.revokedAt, null as any)));

    await logEvent({
      tx,
      category: "records",
      action: "record.deleted",
      summary: `${actorLabel} deleted a record`,
      actorId: session.user.id,
      actorRoleAtTime: actorRole,
      actorLabel,
      targetType: "form_record",
      targetId: recordId,
    });
  });

  revalidatePath("/records");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function bulkSoftDeleteRecords(recordIds: string[]) {
  const session = await requireSuperAdmin();
  if (!recordIds || recordIds.length === 0) return { count: 0 };
  const now = new Date();
  const actorLabel = session.user.name;
  const actorRole = (session.user as { role?: ActorRole }).role ?? null;

  await db.transaction(async (tx) => {
    await tx
      .update(formRecords)
      .set({ deletedAt: now, deletedBy: session.user.id })
      .where(inArray(formRecords.id, recordIds));

    await tx
      .update(shareLinks)
      .set({ revokedAt: now })
      .where(inArray(shareLinks.formRecordId, recordIds));

    for (const id of recordIds) {
      await logEvent({
        tx,
        category: "records",
        action: "record.deleted",
        summary: `${actorLabel} deleted a record (bulk action)`,
        actorId: session.user.id,
        actorRoleAtTime: actorRole,
        actorLabel,
        targetType: "form_record",
        targetId: id,
        metadata: { bulk: true, bulkCount: recordIds.length },
      });
    }
  });

  revalidatePath("/records");
  revalidatePath("/dashboard");
  return { count: recordIds.length };
}

export async function restoreRecord(recordId: string) {
  const session = await requireSuperAdmin();
  const actorLabel = session.user.name;
  const actorRole = (session.user as { role?: ActorRole }).role ?? null;

  await db.transaction(async (tx) => {
    await tx
      .update(formRecords)
      .set({ deletedAt: null, deletedBy: null })
      .where(eq(formRecords.id, recordId));

    await logEvent({
      tx,
      category: "records",
      action: "record.restored",
      summary: `${actorLabel} restored a record from trash`,
      actorId: session.user.id,
      actorRoleAtTime: actorRole,
      actorLabel,
      targetType: "form_record",
      targetId: recordId,
    });
  });

  revalidatePath("/records");
  revalidatePath("/records/trash");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function permanentlyDeleteRecord(recordId: string) {
  const session = await requireSuperAdmin();
  const actorLabel = session.user.name;
  const actorRole = (session.user as { role?: ActorRole }).role ?? null;

  // Render cache (PDF/page-image blobs) is swept by the dedicated
  // /api/cron/cleanup-render-cache cron rather than purged here — it
  // prunes any cache entry whose record no longer exists, covering both
  // this immediate-delete path and the soft-delete-then-trash-purge path.
  await db.transaction(async (tx) => {
    await tx.delete(shareLinks).where(eq(shareLinks.formRecordId, recordId));

    // Logged BEFORE the delete (same transaction either way) so the event
    // row can still reference the record id even though the FK target is
    // about to disappear — targetId is a plain text snapshot, not an FK.
    await logEvent({
      tx,
      category: "records",
      action: "record.permanently_deleted",
      summary: `${actorLabel} permanently deleted a record`,
      actorId: session.user.id,
      actorRoleAtTime: actorRole,
      actorLabel,
      targetType: "form_record",
      targetId: recordId,
    });

    await tx.delete(formRecords).where(eq(formRecords.id, recordId));
  });

  revalidatePath("/records");
  revalidatePath("/records/trash");
  revalidatePath("/dashboard");
  return { success: true };
}
