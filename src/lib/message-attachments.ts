import { headers } from "next/headers";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  conversationParticipants,
  formRecords,
  messageAttachments,
  messages,
  patients,
  shareLinks,
  user,
} from "@/db/schema";
import type { FormType } from "@/lib/validators/form-data";

export type SerializedAttachment =
  | {
      kind: "form_record";
      id: string;
      formRecordId: string;
      available: true;
      formType: FormType;
      status: "draft" | "completed";
      patientName: string;
      hospitalNumber: string;
      updatedAt: string;
    }
  | { kind: "form_record"; id: string; formRecordId: string; available: false }
  | { kind: "share_link"; id: string; shareLinkId: string; url: string; expiresAt: string; revoked: boolean; expired: boolean }
  | { kind: "file"; id: string; fileName: string; fileSize: number; mimeType: string };

async function resolveBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("host");
    const headerOrigin = h.get("origin") || (host ? (host.includes("localhost") ? `http://${host}` : `https://${host}`) : undefined);
    return headerOrigin || process.env.BETTER_AUTH_URL || "http://localhost:3000";
  } catch {
    return process.env.BETTER_AUTH_URL || "http://localhost:3000";
  }
}

/** Fetches and shapes message_attachments rows for the given message ids, keyed by messageId. */
export async function hydrateAttachments(messageIds: string[]): Promise<Map<string, SerializedAttachment[]>> {
  const result = new Map<string, SerializedAttachment[]>();
  if (messageIds.length === 0) return result;

  const rows = await db.select().from(messageAttachments).where(inArray(messageAttachments.messageId, messageIds));
  if (rows.length === 0) return result;

  const formRecordIds = [...new Set(rows.filter((r) => r.kind === "form_record" && r.formRecordId).map((r) => r.formRecordId!))];
  const shareLinkIds = [...new Set(rows.filter((r) => r.kind === "share_link" && r.shareLinkId).map((r) => r.shareLinkId!))];

  const formRecordMap = new Map<
    string,
    { type: FormType; status: "draft" | "completed"; updatedAt: Date; deletedAt: Date | null; surname: string; firstNames: string; hospitalNumber: string }
  >();
  if (formRecordIds.length > 0) {
    const frRows = await db
      .select({
        id: formRecords.id,
        type: formRecords.type,
        status: formRecords.status,
        updatedAt: formRecords.updatedAt,
        deletedAt: formRecords.deletedAt,
        surname: patients.surname,
        firstNames: patients.firstNames,
        hospitalNumber: patients.hospitalNumber,
      })
      .from(formRecords)
      .innerJoin(patients, eq(formRecords.patientId, patients.id))
      .where(inArray(formRecords.id, formRecordIds));
    for (const r of frRows) {
      formRecordMap.set(r.id, {
        type: r.type,
        status: r.status,
        updatedAt: r.updatedAt,
        deletedAt: r.deletedAt,
        surname: r.surname,
        firstNames: r.firstNames,
        hospitalNumber: r.hospitalNumber,
      });
    }
  }

  const shareLinkMap = new Map<string, { token: string; expiresAt: Date; revokedAt: Date | null }>();
  if (shareLinkIds.length > 0) {
    const slRows = await db
      .select({ id: shareLinks.id, token: shareLinks.token, expiresAt: shareLinks.expiresAt, revokedAt: shareLinks.revokedAt })
      .from(shareLinks)
      .where(inArray(shareLinks.id, shareLinkIds));
    for (const r of slRows) shareLinkMap.set(r.id, { token: r.token, expiresAt: r.expiresAt, revokedAt: r.revokedAt });
  }

  const baseUrl = shareLinkIds.length > 0 ? await resolveBaseUrl() : "";
  const now = new Date();

  for (const r of rows) {
    const list = result.get(r.messageId) ?? [];
    if (r.kind === "form_record" && r.formRecordId) {
      const fr = formRecordMap.get(r.formRecordId);
      list.push(
        fr && !fr.deletedAt
          ? {
              kind: "form_record",
              id: r.id,
              formRecordId: r.formRecordId,
              available: true,
              formType: fr.type,
              status: fr.status,
              patientName: `${fr.surname}, ${fr.firstNames}`,
              hospitalNumber: fr.hospitalNumber,
              updatedAt: fr.updatedAt.toISOString(),
            }
          : { kind: "form_record", id: r.id, formRecordId: r.formRecordId, available: false },
      );
    } else if (r.kind === "share_link" && r.shareLinkId) {
      const sl = shareLinkMap.get(r.shareLinkId);
      if (sl) {
        list.push({
          kind: "share_link",
          id: r.id,
          shareLinkId: r.shareLinkId,
          url: `${baseUrl}/s/${sl.token}`,
          expiresAt: sl.expiresAt.toISOString(),
          revoked: Boolean(sl.revokedAt),
          expired: sl.expiresAt < now,
        });
      }
    } else if (r.kind === "file") {
      list.push({
        kind: "file",
        id: r.id,
        fileName: r.fileName ?? "File",
        fileSize: r.fileSize ?? 0,
        mimeType: r.mimeType ?? "application/octet-stream",
      });
    }
    result.set(r.messageId, list);
  }

  return result;
}

/** Live re-check used right before "Open"/"Preview"/"Download" act on a form_record attachment card. */
export async function checkFormRecordAvailable(
  formRecordId: string,
): Promise<{ available: boolean; formType?: FormType }> {
  const [row] = await db
    .select({ type: formRecords.type, deletedAt: formRecords.deletedAt })
    .from(formRecords)
    .where(eq(formRecords.id, formRecordId));
  if (!row || row.deletedAt) return { available: false };
  return { available: true, formType: row.type };
}

/** Live re-check for a share_link attachment card — reflects revocation/expiry immediately. */
export async function checkShareLinkAvailable(shareLinkId: string): Promise<{ available: boolean }> {
  const [row] = await db
    .select({ expiresAt: shareLinks.expiresAt, revokedAt: shareLinks.revokedAt })
    .from(shareLinks)
    .where(eq(shareLinks.id, shareLinkId));
  if (!row || row.revokedAt || row.expiresAt < new Date()) return { available: false };
  return { available: true };
}

export type SharedWithEntry = {
  recipientName: string;
  recipientId: string;
  sentAt: string;
};

/** "Shared with" reverse lookup for a record's page — who has received this record via Messages, and when. */
export async function getRecordShareRecipients(formRecordId: string): Promise<SharedWithEntry[]> {
  const rows = await db
    .select({
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      sentAt: messages.createdAt,
    })
    .from(messageAttachments)
    .innerJoin(messages, eq(messageAttachments.messageId, messages.id))
    .where(and(eq(messageAttachments.kind, "form_record"), eq(messageAttachments.formRecordId, formRecordId), isNull(messages.deletedAt)))
    .orderBy(desc(messages.createdAt));

  if (rows.length === 0) return [];

  const conversationIds = [...new Set(rows.map((r) => r.conversationId))];
  const participantRows = await db
    .select({ conversationId: conversationParticipants.conversationId, userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(inArray(conversationParticipants.conversationId, conversationIds));

  const recipientIdByConv = new Map<string, string[]>();
  for (const p of participantRows) {
    const list = recipientIdByConv.get(p.conversationId) ?? [];
    list.push(p.userId);
    recipientIdByConv.set(p.conversationId, list);
  }

  const userIds = [...new Set(participantRows.map((p) => p.userId))];
  const userRows = userIds.length
    ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, userIds))
    : [];
  const nameById = new Map(userRows.map((u) => [u.id, u.name]));

  const entries: SharedWithEntry[] = [];
  for (const r of rows) {
    const participants = recipientIdByConv.get(r.conversationId) ?? [];
    const recipientId = participants.find((id) => id !== r.senderId);
    if (!recipientId) continue;
    entries.push({
      recipientId,
      recipientName: nameById.get(recipientId) ?? "Unknown admin",
      sentAt: r.sentAt.toISOString(),
    });
  }
  return entries;
}
