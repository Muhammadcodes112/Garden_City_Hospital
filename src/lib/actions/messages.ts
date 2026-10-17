"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversationParticipants, messages, user } from "@/db/schema";
import { STAFF_ROLES, requireStaff } from "@/lib/authz";
import { sendMessageSchema, type SendMessageInput } from "@/lib/validators/message";
import type { ActorRole } from "@/lib/activity";
import { checkFormRecordAvailable, checkPatientFileAvailable, checkShareLinkAvailable, getRecordShareRecipients, type SharedWithEntry } from "@/lib/message-attachments";
import {
  findDmConversationId,
  getMessagesPage,
  getOrCreateDmConversation,
  getParticipantLastReadAt,
  insertMessageWithAttachment,
  isParticipant,
  isUnderSendRateLimit,
  listMessagePeople,
  serializeMessage,
  serializeMessages,
} from "@/lib/messages";

export async function listPeople() {
  const session = await requireStaff();
  return listMessagePeople(session.user.id);
}

export async function getConversationWithUser(targetUserId: string) {
  const session = await requireStaff();
  const meId = session.user.id;
  if (targetUserId === meId) return null;

  const [target] = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned, deletedAt: user.deletedAt })
    .from(user)
    .where(eq(user.id, targetUserId));
  const isCashier = target?.role === "cashier";
  if (!target || (!isCashier && !(STAFF_ROLES as readonly string[]).includes(target.role ?? ""))) return null;

  const removed = Boolean(target.banned) || Boolean(target.deletedAt);
  const conversationId = await findDmConversationId(meId, targetUserId);
  // A cashier thread exists only because they sent a shift report; it's read-only.
  if (isCashier && !conversationId) return null;

  // Can't start a brand-new conversation with an admin who is no longer active.
  if (!conversationId && removed) return null;

  const page = conversationId ? await getMessagesPage(conversationId) : [];
  const otherLastReadAt = conversationId ? await getParticipantLastReadAt(conversationId, targetUserId) : null;

  return {
    targetUser: {
      id: target.id,
      name: target.name,
      email: target.email,
      isSuperAdmin: target.role === "super_admin",
    },
    conversationId,
    readOnly: removed || isCashier,
    readOnlyReason: isCashier
      ? "Cashier accounts don't use messaging. This thread holds the shift reports they've sent."
      : undefined,
    messages: await serializeMessages(page),
    otherLastReadAt: otherLastReadAt ? otherLastReadAt.toISOString() : null,
    hasMore: page.length === 30,
  };
}

export async function loadOlderMessages(conversationId: string, beforeIso: string) {
  const session = await requireStaff();
  const ok = await isParticipant(conversationId, session.user.id);
  if (!ok) throw new Error("Forbidden");

  const page = await getMessagesPage(conversationId, new Date(beforeIso));
  return { messages: await serializeMessages(page), hasMore: page.length === 30 };
}

export async function sendMessage(input: SendMessageInput) {
  const session = await requireStaff();
  const meId = session.user.id;
  const parsed = sendMessageSchema.parse(input);

  if (parsed.targetUserId === meId) {
    throw new Error("You can't message yourself");
  }

  const [target] = await db
    .select({ id: user.id, role: user.role, banned: user.banned, deletedAt: user.deletedAt })
    .from(user)
    .where(eq(user.id, parsed.targetUserId));
  // Messaging is clinical-staff only; never a patient or cashier account.
  if (!target || !(STAFF_ROLES as readonly string[]).includes(target.role ?? "")) throw new Error("Recipient not found");

  const removed = Boolean(target.banned) || Boolean(target.deletedAt);
  let conversationId = await findDmConversationId(meId, parsed.targetUserId);

  if (!conversationId) {
    if (removed) throw new Error("This admin account is no longer active");
    conversationId = await getOrCreateDmConversation(meId, parsed.targetUserId);
  } else if (removed) {
    throw new Error("This conversation is read-only — the other admin's account is no longer active");
  }

  if (!(await isUnderSendRateLimit(meId))) {
    throw new Error("You're sending messages too fast. Please wait a moment and try again.");
  }

  const body = parsed.body && parsed.body.length > 0 ? parsed.body : null;

  // Activity log records that a message was sent, who sent it, and which conversation — never the content.
  const created = await insertMessageWithAttachment({
    conversationId: conversationId!,
    senderId: meId,
    body,
    attachment: parsed.attachment,
    activityLog: {
      category: "messages",
      action: "message.sent",
      summary: `${session.user.name} sent a message`,
      actorRoleAtTime: (session.user as { role?: ActorRole }).role ?? null,
      actorLabel: session.user.name,
      metadata: { recipientId: parsed.targetUserId },
    },
  });

  return serializeMessage(created);
}

export async function deleteMessage(messageId: string) {
  const session = await requireStaff();

  const [msg] = await db.select().from(messages).where(eq(messages.id, messageId));
  if (!msg) throw new Error("Message not found");
  if (msg.senderId !== session.user.id) throw new Error("You can only delete your own messages");

  if (!msg.deletedAt) {
    await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, messageId));
  }
  return { success: true };
}

/** "Shared with" line on a record's page — visible to any admin who can see the record. */
export async function getSharedWith(formRecordId: string): Promise<SharedWithEntry[]> {
  await requireStaff();
  return getRecordShareRecipients(formRecordId);
}

/** Live re-check used by an attachment card right before Open/Preview/Download act on it. */
export async function checkFormRecordAvailability(formRecordId: string) {
  await requireStaff();
  return checkFormRecordAvailable(formRecordId);
}

/** Live re-check for a share_link attachment — catches a since-revoked or expired link. */
export async function checkShareLinkAvailability(shareLinkId: string) {
  await requireStaff();
  return checkShareLinkAvailable(shareLinkId);
}

/** Live re-check for a patient_file attachment — catches a since-deleted patient. */
export async function checkPatientFileAvailability(patientId: string) {
  await requireStaff();
  return checkPatientFileAvailable(patientId);
}

export async function markConversationRead(conversationId: string) {
  const session = await requireStaff();
  const ok = await isParticipant(conversationId, session.user.id);
  if (!ok) throw new Error("Forbidden");

  await db
    .update(conversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, session.user.id)));
  return { success: true };
}
