import { NextResponse } from "next/server";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { signUpSchema } from "@/lib/validators/auth";

/**
 * The only way to create an account in this app. Better Auth's own
 * sign-up endpoint is blocked at /api/auth/[...all]/route.ts — registration
 * is gated on ADMIN_SIGNUP_CODE, which that endpoint has no concept of, so
 * the check has to happen here before Better Auth is ever invoked.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, password, adminCode } = parsed.data;

  if (!process.env.ADMIN_SIGNUP_CODE || adminCode !== process.env.ADMIN_SIGNUP_CODE) {
    return NextResponse.json(
      { error: { formErrors: ["Invalid admin access code"], fieldErrors: {} } },
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
