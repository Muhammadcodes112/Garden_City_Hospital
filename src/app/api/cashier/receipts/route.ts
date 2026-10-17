import { NextResponse } from "next/server";
import { requireCashierArea } from "@/lib/authz";
import { issueReceiptAs } from "@/lib/cashier-service";

export const dynamic = "force-dynamic";

/** Issue a receipt. 403 for non-cashiers, 409 without an open shift. */
export async function POST(req: Request) {
  const { session, role } = await requireCashierArea();
  const body = await req.json().catch(() => null);
  const result = await issueReceiptAs({ id: session.user.id, name: session.user.name, role }, body);
  return NextResponse.json(result.body, { status: result.status });
}
