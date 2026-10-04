import { and, desc, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversationParticipants, conversations, messages, user } from "@/db/schema";

export function dmKeyFor(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(":");
}

export type MessageRow = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
};

export type SerializedMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

export function serializeMessage(m: MessageRow): SerializedMessage {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
  };
}

export type PersonSummary = {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  /** Banned or soft-deleted — excluded from "start a new conversation" but kept visible if a thread already exists. */
  removed: boolean;
  conversationId: string | null;
  muted: boolean;
  unreadCount: number;
  lastMessage: { preview: string; at: string; fromMe: boolean } | null;
  /** The other participant's last_read_at — used to render "Seen" on my latest message. */
  otherLastReadAt: string | null;
};

async function getLastMessageByConversation(conversationIds: string[]) {
  const map = new Map<
    string,
    { id: string; senderId: string; body: string | null; createdAt: Date; deletedAt: Date | null }
  >();
  if (conversationIds.length === 0) return map;

  const idList = sql.join(
    conversationIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (conversation_id) id, conversation_id, sender_id, body, created_at, deleted_at
    FROM messages
    WHERE conversation_id IN (${idList})
    ORDER BY conversation_id, created_at DESC
  `)) as unknown as Array<{
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string | null;
    created_at: Date;
    deleted_at: Date | null;
  }>;

  for (const r of rows) {
    map.set(r.conversation_id, {
      id: r.id,
      senderId: r.sender_id,
      body: r.body,
      createdAt: new Date(r.created_at),
      deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
    });
  }
  return map;
}

async function getUnreadCounts(
  conversationIds: string[],
  meId: string,
  lastReadAtByConv: Map<string, Date | null>,
) {
  const counts = new Map<string, number>();
  if (conversationIds.length === 0) return counts;

  const incoming = await db
    .select({ conversationId: messages.conversationId, createdAt: messages.createdAt })
    .from(messages)
    .where(
      and(
        inArray(messages.conversationId, conversationIds),
        ne(messages.senderId, meId),
        sql`${messages.deletedAt} IS NULL`,
      ),
    );

  for (const row of incoming) {
    const threshold = lastReadAtByConv.get(row.conversationId) ?? null;
    if (!threshold || row.createdAt > threshold) {
      counts.set(row.conversationId, (counts.get(row.conversationId) ?? 0) + 1);
    }
  }
  return counts;
}

/** Every admin except `meId` who should appear in the people list, with conversation previews. */
export async function listMessagePeople(meId: string): Promise<PersonSummary[]> {
  const allUsers = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      deletedAt: user.deletedAt,
    })
    .from(user)
    .where(ne(user.id, meId));

  const myParticipantRows = await db
    .select({
      conversationId: conversationParticipants.conversationId,
      lastReadAt: conversationParticipants.lastReadAt,
      muted: conversationParticipants.muted,
    })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, meId));

  const myConvIds = myParticipantRows.map((r) => r.conversationId);
  const lastReadByConv = new Map(myParticipantRows.map((r) => [r.conversationId, r.lastReadAt]));
  const mutedByConv = new Map(myParticipantRows.map((r) => [r.conversationId, r.muted]));

  const otherParticipantRows = myConvIds.length
    ? await db
        .select({
          conversationId: conversationParticipants.conversationId,
          userId: conversationParticipants.userId,
          lastReadAt: conversationParticipants.lastReadAt,
        })
        .from(conversationParticipants)
        .where(and(inArray(conversationParticipants.conversationId, myConvIds), ne(conversationParticipants.userId, meId)))
    : [];
  const convIdByOtherUser = new Map(otherParticipantRows.map((r) => [r.userId, r.conversationId]));
  const otherLastReadByUser = new Map(otherParticipantRows.map((r) => [r.userId, r.lastReadAt]));

  const lastMsgByConv = await getLastMessageByConversation(myConvIds);
  const unreadByConv = await getUnreadCounts(myConvIds, meId, lastReadByConv);

  const results: PersonSummary[] = [];
  for (const u of allUsers) {
    const removed = Boolean(u.banned) || Boolean(u.deletedAt);
    const conversationId = convIdByOtherUser.get(u.id) ?? null;
    if (removed && !conversationId) continue;

    const last = conversationId ? lastMsgByConv.get(conversationId) : undefined;
    results.push({
      id: u.id,
      name: u.name,
      email: u.email,
      isSuperAdmin: u.role === "super_admin",
      removed,
      conversationId,
      muted: conversationId ? Boolean(mutedByConv.get(conversationId)) : false,
      unreadCount: conversationId ? unreadByConv.get(conversationId) ?? 0 : 0,
      otherLastReadAt: conversationId ? otherLastReadByUser.get(u.id)?.toISOString() ?? null : null,
      lastMessage: last
        ? {
            preview: last.deletedAt ? "This message was deleted" : last.body?.trim() || "Sent an attachment",
            at: last.createdAt.toISOString(),
            fromMe: last.senderId === meId,
          }
        : null,
    });
  }

  results.sort((a, b) => {
    const aUnread = a.unreadCount > 0;
    const bUnread = b.unreadCount > 0;
    if (aUnread !== bUnread) return aUnread ? -1 : 1;
    const aAt = a.lastMessage?.at ?? null;
    const bAt = b.lastMessage?.at ?? null;
    if (aAt && bAt && aAt !== bAt) return aAt > bAt ? -1 : 1;
    if (aAt && !bAt) return -1;
    if (!aAt && bAt) return 1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

export async function findDmConversationId(meId: string, targetUserId: string): Promise<string | null> {
  const key = dmKeyFor(meId, targetUserId);
  const [row] = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.dmKey, key));
  return row?.id ?? null;
}

export async function getOrCreateDmConversation(meId: string, targetUserId: string): Promise<string> {
  const key = dmKeyFor(meId, targetUserId);
  const [row] = await db
    .insert(conversations)
    .values({ dmKey: key })
    .onConflictDoUpdate({ target: conversations.dmKey, set: { dmKey: key } })
    .returning({ id: conversations.id });
  const conversationId = row!.id;

  await db
    .insert(conversationParticipants)
    .values([
      { conversationId, userId: meId },
      { conversationId, userId: targetUserId },
    ])
    .onConflictDoNothing();

  return conversationId;
}

export async function isParticipant(conversationId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)));
  return Boolean(row);
}

export async function getParticipantLastReadAt(conversationId: string, userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ lastReadAt: conversationParticipants.lastReadAt })
    .from(conversationParticipants)
    .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)));
  return row?.lastReadAt ?? null;
}

export async function getOtherParticipantId(conversationId: string, meId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(and(eq(conversationParticipants.conversationId, conversationId), ne(conversationParticipants.userId, meId)));
  return row?.userId ?? null;
}

export async function getMessagesPage(
  conversationId: string,
  before?: Date,
  limit = 30,
): Promise<MessageRow[]> {
  const conditions = [eq(messages.conversationId, conversationId)];
  if (before) conditions.push(lt(messages.createdAt, before));

  const rows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows.reverse();
}

/** Messages in any of `meId`'s conversations created, or soft-deleted, since `since` — used by the poll endpoint. */
export async function getMessageUpdatesSince(meId: string, since: Date): Promise<MessageRow[]> {
  const myConvIds = (
    await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, meId))
  ).map((r) => r.conversationId);

  if (myConvIds.length === 0) return [];

  return db
    .select()
    .from(messages)
    .where(and(inArray(messages.conversationId, myConvIds), or(gt(messages.createdAt, since), gt(messages.deletedAt, since))))
    .orderBy(messages.createdAt);
}
