"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversationParticipants, messages, user } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { sendMessageSchema, type SendMessageInput } from "@/lib/validators/message";
import { checkFormRecordAvailable, checkShareLinkAvailable, getRecordShareRecipients, type SharedWithEntry } from "@/lib/message-attachments";
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
  const session = await requireAdmin();
  return listMessagePeople(session.user.id);
}

export async function getConversationWithUser(targetUserId: string) {
  const session = await requireAdmin();
  const meId = session.user.id;
  if (targetUserId === meId) return null;

  const [target] = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned, deletedAt: user.deletedAt })
    .from(user)
    .where(eq(user.id, targetUserId));
  if (!target) return null;

  const removed = Boolean(target.banned) || Boolean(target.deletedAt);
  const conversationId = await findDmConversationId(meId, targetUserId);

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
    readOnly: removed,
    messages: await serializeMessages(page),
    otherLastReadAt: otherLastReadAt ? otherLastReadAt.toISOString() : null,
    hasMore: page.length === 30,
  };
}

export async function loadOlderMessages(conversationId: string, beforeIso: string) {
  const session = await requireAdmin();
  const ok = await isParticipant(conversationId, session.user.id);
  if (!ok) throw new Error("Forbidden");

  const page = await getMessagesPage(conversationId, new Date(beforeIso));
  return { messages: await serializeMessages(page), hasMore: page.length === 30 };
}

export async function sendMessage(input: SendMessageInput) {
  const session = await requireAdmin();
  const meId = session.user.id;
  const parsed = sendMessageSchema.parse(input);

  if (parsed.targetUserId === meId) {
    throw new Error("You can't message yourself");
  }

  const [target] = await db
    .select({ id: user.id, banned: user.banned, deletedAt: user.deletedAt })
    .from(user)
    .where(eq(user.id, parsed.targetUserId));
  if (!target) throw new Error("Recipient not found");

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
    activityLog: { action: "message_sent" },
  });

  return serializeMessage(created);
}

export async function deleteMessage(messageId: string) {
  const session = await requireAdmin();

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
  await requireAdmin();
  return getRecordShareRecipients(formRecordId);
}

/** Live re-check used by an attachment card right before Open/Preview/Download act on it. */
export async function checkFormRecordAvailability(formRecordId: string) {
  await requireAdmin();
  return checkFormRecordAvailable(formRecordId);
}

/** Live re-check for a share_link attachment — catches a since-revoked or expired link. */
export async function checkShareLinkAvailability(shareLinkId: string) {
  await requireAdmin();
  return checkShareLinkAvailable(shareLinkId);
}

export async function markConversationRead(conversationId: string) {
  const session = await requireAdmin();
  const ok = await isParticipant(conversationId, session.user.id);
  if (!ok) throw new Error("Forbidden");

  await db
    .update(conversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, session.user.id)));
  return { success: true };
}
