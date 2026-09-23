import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { signUpSchema } from "@/lib/validators/auth";
import { verifyAccessCode } from "@/lib/access-code";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, password, adminCode } = parsed.data;

  const reqHeaders = await headers();
  const ipAddress =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    reqHeaders.get("x-real-ip") ||
    "127.0.0.1";

  const accessCodeCheck = await verifyAccessCode(adminCode, ipAddress, email);
  if (!accessCodeCheck.valid) {
    return NextResponse.json(
      { error: { formErrors: [accessCodeCheck.error || "Invalid admin access code"], fieldErrors: {} } },
      { status: 403 },
    );
  }

  try {
    return await auth.api.signUpEmail({
      body: { name, email, password },
      asResponse: true,
    });
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
