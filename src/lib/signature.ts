import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";

/** The signature image a doctor/staff member has saved to their account, if any. */
export async function getSavedSignatureUrl(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ signatureUrl: user.signatureUrl })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row?.signatureUrl || null;
}
