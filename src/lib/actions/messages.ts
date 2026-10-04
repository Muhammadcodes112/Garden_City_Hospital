"use server";

import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, conversationParticipants, conversations, messageAttachments, messages, user } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { sendMessageSchema, type SendMessageInput } from "@/lib/validators/message";
import {
  findDmConversationId,
  getMessagesPage,
  getOrCreateDmConversation,
  getParticipantLastReadAt,
  isParticipant,
  listMessagePeople,
  serializeMessage,
} from "@/lib/messages";

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

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
    messages: page.map(serializeMessage),
    otherLastReadAt: otherLastReadAt ? otherLastReadAt.toISOString() : null,
    hasMore: page.length === 30,
  };
}

export async function loadOlderMessages(conversationId: string, beforeIso: string) {
  const session = await requireAdmin();
  const ok = await isParticipant(conversationId, session.user.id);
  if (!ok) throw new Error("Forbidden");

  const page = await getMessagesPage(conversationId, new Date(beforeIso));
  return { messages: page.map(serializeMessage), hasMore: page.length === 30 };
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

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recentSent = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.senderId, meId), gt(messages.createdAt, windowStart)));
  if (recentSent.length >= RATE_LIMIT_MAX) {
    throw new Error("You're sending messages too fast. Please wait a moment and try again.");
  }

  const body = parsed.body && parsed.body.length > 0 ? parsed.body : null;
  const attachment = parsed.attachment;

  const created = await db.transaction(async (tx) => {
    const [message] = await tx
      .insert(messages)
      .values({ conversationId: conversationId!, senderId: meId, body })
      .returning();

    if (attachment) {
      await tx.insert(messageAttachments).values(
        attachment.kind === "form_record"
          ? { messageId: message!.id, kind: "form_record", formRecordId: attachment.formRecordId }
          : attachment.kind === "share_link"
            ? { messageId: message!.id, kind: "share_link", shareLinkId: attachment.shareLinkId }
            : {
                messageId: message!.id,
                kind: "file",
                fileUrl: attachment.fileUrl,
                fileName: attachment.fileName,
                fileSize: attachment.fileSize,
                mimeType: attachment.mimeType,
              },
      );
    }

    await tx.update(conversations).set({ lastMessageAt: message!.createdAt }).where(eq(conversations.id, conversationId!));

    // Activity log records that a message was sent, who sent it, and which conversation — never the content.
    await tx.insert(activityLogs).values({ userId: meId, conversationId: conversationId!, action: "message_sent" });

    return message!;
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
