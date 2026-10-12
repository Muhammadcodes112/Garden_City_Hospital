import "server-only";
import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/db";
import { activityEvents } from "@/db/schema";

export type ActivityCategory = "auth" | "records" | "sharing" | "messages" | "appointments" | "accounts";
export type ActorRole = "patient" | "admin" | "super_admin";

export type LogEventInput = {
  category: ActivityCategory;
  action: string;
  summary: string;
  actorId?: string | null;
  actorRoleAtTime?: ActorRole | null;
  actorLabel?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
  /**
   * Pass the active `tx` from db.transaction(async (tx) => {...}) so this
   * INSERT is part of the SAME transaction as the action it records — a
   * rolled-back action then never leaves a phantom log line. Omit for
   * single-statement actions with nothing else to roll back alongside.
   *
   * Caveat: if the insert itself fails while inside a passed-in tx, the
   * underlying Postgres transaction is poisoned regardless of this
   * function catching the JS error (Postgres aborts the whole transaction
   * on any statement failure) — catching here stops the failure from
   * crashing the request, but can't un-poison an already-open tx. In
   * practice this only matters for genuine DB-level failures (network,
   * pool exhaustion), not normal operation.
   */
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;
};

function hashIp(ip: string): string {
  const secret = process.env.BETTER_AUTH_SECRET || "garden_city_ip_hash_fallback";
  return crypto.createHmac("sha256", secret).update(ip).digest("hex");
}

/**
 * The one write path into activity_events. Never throws — a logging
 * failure must never fail the user's action; errors are caught, reported
 * to Sentry, and swallowed.
 */
export async function logEvent(input: LogEventInput): Promise<void> {
  const client = input.tx ?? db;
  try {
    await client.insert(activityEvents).values({
      category: input.category,
      action: input.action,
      summary: input.summary,
      actorId: input.actorId ?? null,
      actorRoleAtTime: input.actorRoleAtTime ?? null,
      actorLabel: input.actorLabel ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      ipHash: input.ipAddress ? hashIp(input.ipAddress) : null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.error("logEvent failed:", input.category, input.action, err);
    Sentry.captureException(err, { extra: { category: input.category, action: input.action, summary: input.summary } });
  }
}

/** Shallow count of top-level keys whose JSON-serialized value differs between two form-data objects. */
export function countChangedFields(before: Record<string, unknown>, after: Record<string, unknown>): number {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  let count = 0;
  for (const key of keys) {
    if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) count++;
  }
  return count;
}

/** Best-effort client IP extraction, matching the pattern used elsewhere in this app (sign-up rate limiting). */
export function clientIpFrom(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}
