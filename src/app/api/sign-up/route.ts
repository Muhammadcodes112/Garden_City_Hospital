import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { signUpSchema } from "@/lib/validators/auth";
import { verifyAccessCode } from "@/lib/access-code";
import { checkSignupRateLimit } from "@/lib/signup-rate-limit";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, phone, email, password, adminCode } = parsed.data;

  const reqHeaders = await headers();
  const ipAddress =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    reqHeaders.get("x-real-ip") ||
    "127.0.0.1";

  // Hard rate limit, checked (and logged) before anything else — a request
  // that fails validation below still counts against the limit.
  const rateLimit = await checkSignupRateLimit(ipAddress, email);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { formErrors: [rateLimit.error], fieldErrors: {} } },
      { status: 429 },
    );
  }

  // "I'm hospital staff": optional access code. Blank/omitted -> public
  // patient sign-up (no code needed). Present -> must be valid, and the
  // account is created as 'admin' instead of the 'patient' default.
  const wantsStaff = Boolean(adminCode && adminCode.trim());
  if (wantsStaff) {
    const accessCodeCheck = await verifyAccessCode(adminCode!, ipAddress, email);
    if (!accessCodeCheck.valid) {
      return NextResponse.json(
        { error: { formErrors: [accessCodeCheck.error || "Invalid staff access code"], fieldErrors: {} } },
        { status: 403 },
      );
    }
  }

  try {
    const signUpResponse = await auth.api.signUpEmail({
      body: { name, email, password, phone },
      asResponse: true,
    });

    if (wantsStaff && signUpResponse.ok) {
      const created = await signUpResponse.clone().json().catch(() => null);
      const newUserId: string | undefined = created?.user?.id;
      if (newUserId) {
        await db.update(userTable).set({ role: "admin" }).where(eq(userTable.id, newUserId));
      }
    }

    return signUpResponse;
  } catch (err) {
    if (err instanceof APIError) {
      return NextResponse.json(
        { error: { formErrors: [err.message], fieldErrors: {} } },
        { status: 400 },
      );
    }
    throw err;
  }
}
