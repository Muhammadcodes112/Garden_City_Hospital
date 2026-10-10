import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { signupAttempts } from "@/db/schema";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_IP = 8;
const MAX_PER_EMAIL = 3;

export type SignupRateLimitResult = { allowed: true } | { allowed: false; error: string };

/**
 * Hard per-IP and per-email sign-up rate limit. Logs this attempt
 * unconditionally before returning — a request that fails downstream
 * validation still counts, so the limit can't be bypassed by sending
 * deliberately-invalid payloads.
 */
export async function checkSignupRateLimit(ipAddress: string, email: string): Promise<SignupRateLimitResult> {
  const since = new Date(Date.now() - WINDOW_MS);

  const [ipCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(signupAttempts)
    .where(and(eq(signupAttempts.ipAddress, ipAddress), gte(signupAttempts.createdAt, since)));

  const [emailCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(signupAttempts)
    .where(and(eq(signupAttempts.email, email.toLowerCase()), gte(signupAttempts.createdAt, since)));

  await db.insert(signupAttempts).values({ ipAddress, email: email.toLowerCase() });

  if (Number(ipCount?.count || 0) >= MAX_PER_IP) {
    return { allowed: false, error: "Too many sign-up attempts from this network. Please try again in an hour." };
  }
  if (Number(emailCount?.count || 0) >= MAX_PER_EMAIL) {
    return { allowed: false, error: "Too many sign-up attempts for this email. Please try again in an hour." };
  }

  return { allowed: true };
}
