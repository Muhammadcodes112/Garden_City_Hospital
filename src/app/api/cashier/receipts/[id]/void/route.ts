import { NextResponse } from "next/server";
import { requireCashierArea } from "@/lib/authz";
import { voidReceiptAs } from "@/lib/cashier-service";

export const dynamic = "force-dynamic";

/**
 * Void a receipt with a typed reason. A cashier gets 403 for another
 * cashier's receipt, a closed shift, or one past the void window.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, role } = await requireCashierArea();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { reason?: unknown } | null;
  const result = await voidReceiptAs({ id: session.user.id, name: session.user.name, role }, id, body?.reason);
  return NextResponse.json(result.body, { status: result.status });
}
