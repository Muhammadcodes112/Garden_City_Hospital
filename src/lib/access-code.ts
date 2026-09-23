import crypto from "crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { accessCodeSettings, failedSignups } from "@/db/schema";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 32 unambiguous chars (no 0/O, 1/I/L)

export type AccessCodeInfo = {
  code: string;
  periodSeconds: number;
  anchorAt: string;
  version: number;
  updatedAt: string;
  nextRotationAt: string;
  secondsRemaining: number;
  formattedCountdown: string;
  isUnder24Hours: boolean;
};

function getSecret(): string {
  return (
    process.env.ACCESS_CODE_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    "garden_city_access_secret_key_2026"
  );
}

export function formatAccessCode(raw8: string): string {
  const cleaned = raw8.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (cleaned.length !== 8) return raw8;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}

export function deriveAccessCode(version: number, periodIndex: number): string {
  const secret = getSecret();
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${version}:${periodIndex}`);
  const hash = hmac.digest();

  let codeChars = "";
  for (let i = 0; i < 8; i++) {
    const byte = hash[i]! ^ hash[i + 8]! ^ hash[i + 16]! ^ hash[i + 24]!;
    codeChars += ALPHABET[byte % ALPHABET.length];
  }

  return formatAccessCode(codeChars);
}

export async function getOrCreateAccessCodeSettings() {
  const rows = await db
    .select()
    .from(accessCodeSettings)
    .where(eq(accessCodeSettings.id, "default"))
    .limit(1);

  if (rows[0]) return rows[0];

  const now = new Date();
  const [created] = await db
    .insert(accessCodeSettings)
    .values({
      id: "default",
      periodSeconds: 2592000, // 30 days
      anchorAt: now,
      version: 1,
      updatedAt: now,
    })
    .returning();

  return created!;
}

export function formatRemainingTime(seconds: number): { text: string; isUnder24Hours: boolean } {
  if (seconds <= 0) return { text: "Renews now", isUnder24Hours: true };

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (seconds < 86400) {
    return {
      text: `Renews in ${hours} hrs ${mins} mins`,
      isUnder24Hours: true,
    };
  }

  return {
    text: `Renews in ${days} days ${hours} hrs`,
    isUnder24Hours: false,
  };
}

export async function getCurrentAccessCodeInfo(): Promise<AccessCodeInfo> {
  const settings = await getOrCreateAccessCodeSettings();
  const nowMs = Date.now();
  const anchorMs = settings.anchorAt.getTime();
  const periodMs = settings.periodSeconds * 1000;

  const periodIndex = Math.floor(Math.max(0, nowMs - anchorMs) / periodMs);
  const currentCode = deriveAccessCode(settings.version, periodIndex);

  const nextRotationMs = anchorMs + (periodIndex + 1) * periodMs;
  const secondsRemaining = Math.max(0, Math.floor((nextRotationMs - nowMs) / 1000));
  const { text: formattedCountdown, isUnder24Hours } = formatRemainingTime(secondsRemaining);

  return {
    code: currentCode,
    periodSeconds: settings.periodSeconds,
    anchorAt: settings.anchorAt.toISOString(),
    version: settings.version,
    updatedAt: settings.updatedAt.toISOString(),
    nextRotationAt: new Date(nextRotationMs).toISOString(),
    secondsRemaining,
    formattedCountdown,
    isUnder24Hours,
  };
}

export async function verifyAccessCode(inputCode: string, ipAddress?: string, email?: string): Promise<{ valid: boolean; error?: string }> {
  // Rate limit check: max 5 failed attempts in last 15 minutes
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (ipAddress) {
    const recentFailures = await db
      .select({ count: sql<number>`count(*)` })
      .from(failedSignups)
      .where(and(eq(failedSignups.ipAddress, ipAddress), gte(failedSignups.createdAt, fifteenMinsAgo)));

    const count = Number(recentFailures[0]?.count || 0);
    if (count >= 5) {
      return {
        valid: false,
        error: "Too many failed sign-up attempts. Please wait 15 minutes before trying again.",
      };
    }
  }

  const cleanedInput = formatAccessCode(inputCode.trim());
  const settings = await getOrCreateAccessCodeSettings();
  const nowMs = Date.now();
  const anchorMs = settings.anchorAt.getTime();
  const periodMs = settings.periodSeconds * 1000;

  const periodIndex = Math.floor(Math.max(0, nowMs - anchorMs) / periodMs);
  const currentCode = deriveAccessCode(settings.version, periodIndex);

  // Constant time comparison for current code
  const isCurrentMatch =
    cleanedInput.length === currentCode.length &&
    crypto.timingSafeEqual(Buffer.from(cleanedInput), Buffer.from(currentCode));

  if (isCurrentMatch) {
    return { valid: true };
  }

  // Grace Period Check:
  // Accept previous period code for 10 minutes after an automatic rotation
  // ONLY if manual regenerate didn't happen in the last 10 minutes
  const elapsedInCurrentPeriodMs = (nowMs - anchorMs) % periodMs;
  const isAutoRotatedRecently = periodIndex > 0 && elapsedInCurrentPeriodMs <= 10 * 60 * 1000;
  const isManualRegenRecently = nowMs - settings.updatedAt.getTime() <= 10 * 60 * 1000 && settings.anchorAt.getTime() === settings.updatedAt.getTime();

  if (isAutoRotatedRecently && !isManualRegenRecently) {
    const prevCode = deriveAccessCode(settings.version, periodIndex - 1);
    const isPrevMatch =
      cleanedInput.length === prevCode.length &&
      crypto.timingSafeEqual(Buffer.from(cleanedInput), Buffer.from(prevCode));

    if (isPrevMatch) {
      return { valid: true };
    }
  }

  // Log failed attempt
  await db.insert(failedSignups).values({
    ipAddress: ipAddress || "unknown",
    email: email || "unknown",
    reason: "Invalid admin access code",
  });

  return { valid: false, error: "Invalid admin access code" };
}

export async function updateRotationPeriod(newPeriodSeconds: number, userId: string) {
  // Validate min 1 hr (3600s), max 90 days (7,776,000s)
  const clampedSeconds = Math.max(3600, Math.min(7776000, newPeriodSeconds));
  const now = new Date();

  await db
    .insert(accessCodeSettings)
    .values({
      id: "default",
      periodSeconds: clampedSeconds,
      anchorAt: now,
      version: 1,
      updatedBy: userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: accessCodeSettings.id,
      set: {
        periodSeconds: clampedSeconds,
        anchorAt: now,
        updatedBy: userId,
        updatedAt: now,
      },
    });

  return getCurrentAccessCodeInfo();
}

export async function regenerateAccessCodeNow(userId: string) {
  const settings = await getOrCreateAccessCodeSettings();
  const now = new Date();

  await db
    .update(accessCodeSettings)
    .set({
      version: settings.version + 1,
      anchorAt: now,
      updatedBy: userId,
      updatedAt: now,
    })
    .where(eq(accessCodeSettings.id, "default"));

  return getCurrentAccessCodeInfo();
}
