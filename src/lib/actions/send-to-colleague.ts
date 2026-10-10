"use server";

import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { formRecords, user } from "@/db/schema";
import { requireStaff } from "@/lib/authz";
import { sendRecordToColleaguesSchema, type SendRecordToColleaguesInput } from "@/lib/validators/send-to-colleague";
import { findDmConversationId, getOrCreateDmConversation, insertMessageWithAttachment, isUnderSendRateLimit } from "@/lib/messages";
import { createShareLink } from "@/lib/actions/share";

export type ActiveAdmin = { id: string; name: string; email: string; isSuperAdmin: boolean };

/** Every active (non-banned, non-deleted) admin except the caller — the colleague picker's roster. */
export async function listActiveAdmins(): Promise<ActiveAdmin[]> {
  const session = await requireStaff();
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(and(ne(user.id, session.user.id), eq(user.banned, false), isNull(user.deletedAt)));
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, isSuperAdmin: r.role === "super_admin" }));
}

export async function sendRecordToColleagues(input: SendRecordToColleaguesInput): Promise<{ count: number }> {
  const session = await requireStaff();
  const meId = session.user.id;
  const parsed = sendRecordToColleaguesSchema.parse(input);

  const [record] = await db.select({ id: formRecords.id }).from(formRecords).where(eq(formRecords.id, parsed.formRecordId));
  if (!record) throw new Error("Record not found");

  const recipientRows = await db
    .select({ id: user.id, banned: user.banned, deletedAt: user.deletedAt })
    .from(user)
    .where(inArray(user.id, parsed.recipientUserIds));
  const recipientIds = recipientRows.filter((r) => r.id !== meId && !r.banned && !r.deletedAt).map((r) => r.id);
  if (recipientIds.length === 0) throw new Error("No valid recipients selected");

  if (!(await isUnderSendRateLimit(meId, recipientIds.length))) {
    throw new Error("Too many messages at once — try sending to fewer colleagues, or again in a minute.");
  }

  let shareLinkId: string | undefined;
  if (parsed.createExternalLink) {
    const link = await createShareLink({ formRecordId: parsed.formRecordId, expiryDays: 7 });
    shareLinkId = link.id;
  }

  const body = parsed.note && parsed.note.length > 0 ? parsed.note : null;

  for (const recipientId of recipientIds) {
    const conversationId = (await findDmConversationId(meId, recipientId)) ?? (await getOrCreateDmConversation(meId, recipientId));

    await insertMessageWithAttachment({
      conversationId,
      senderId: meId,
      body,
      attachment: shareLinkId ? { kind: "share_link", shareLinkId } : { kind: "form_record", formRecordId: parsed.formRecordId },
      activityLog: { action: "record_shared_internally", formRecordId: parsed.formRecordId },
    });
  }

  return { count: recipientIds.length };
}
