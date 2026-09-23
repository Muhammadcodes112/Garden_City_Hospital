"use server";

import fs from "fs";
import path from "path";
import { and, inArray, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, formRecords, shareLinks } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function softDeleteRecord(recordId: string) {
  const session = await requireSuperAdmin();
  const now = new Date();

  // 1. Soft-delete the record
  await db
    .update(formRecords)
    .set({
      deletedAt: now,
      deletedBy: session.user.id,
    })
    .where(eq(formRecords.id, recordId));

  // 2. Immediately revoke all share links
  await db
    .update(shareLinks)
    .set({ revokedAt: now })
    .where(and(eq(shareLinks.formRecordId, recordId), eq(shareLinks.revokedAt, null as any)));

  // 3. Log activity
  await db.insert(activityLogs).values({
    userId: session.user.id,
    formRecordId: recordId,
    action: "soft_deleted",
  });

  revalidatePath("/records");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function bulkSoftDeleteRecords(recordIds: string[]) {
  const session = await requireSuperAdmin();
  if (!recordIds || recordIds.length === 0) return { count: 0 };
  const now = new Date();

  await db
    .update(formRecords)
    .set({
      deletedAt: now,
      deletedBy: session.user.id,
    })
    .where(inArray(formRecords.id, recordIds));

  await db
    .update(shareLinks)
    .set({ revokedAt: now })
    .where(inArray(shareLinks.formRecordId, recordIds));

  for (const id of recordIds) {
    await db.insert(activityLogs).values({
      userId: session.user.id,
      formRecordId: id,
      action: "soft_deleted",
    });
  }

  revalidatePath("/records");
  revalidatePath("/dashboard");
  return { count: recordIds.length };
}

export async function restoreRecord(recordId: string) {
  const session = await requireSuperAdmin();

  await db
    .update(formRecords)
    .set({
      deletedAt: null,
      deletedBy: null,
    })
    .where(eq(formRecords.id, recordId));

  await db.insert(activityLogs).values({
    userId: session.user.id,
    formRecordId: recordId,
    action: "restored",
  });

  revalidatePath("/records");
  revalidatePath("/records/trash");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function permanentlyDeleteRecord(recordId: string) {
  const session = await requireSuperAdmin();

  // Purge disk cache for page previews
  try {
    const cacheDir = path.join(process.cwd(), "public", "cache", "page-previews");
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      for (const file of files) {
        if (file.startsWith(recordId)) {
          fs.unlinkSync(path.join(cacheDir, file));
        }
      }
    }
  } catch (err) {
    console.error("Error clearing page preview cache:", err);
  }

  // Delete share links
  await db.delete(shareLinks).where(eq(shareLinks.formRecordId, recordId));

  // Log activity BEFORE deleting the record (so record ID is referenced properly or null)
  await db.insert(activityLogs).values({
    userId: session.user.id,
    formRecordId: null,
    action: "permanently_deleted",
  });

  // Permanently delete form record
  await db.delete(formRecords).where(eq(formRecords.id, recordId));

  revalidatePath("/records");
  revalidatePath("/records/trash");
  revalidatePath("/dashboard");
  return { success: true };
}
