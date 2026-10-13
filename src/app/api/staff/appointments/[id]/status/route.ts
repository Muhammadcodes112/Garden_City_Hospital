import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { staffUpdateAppointmentStatus } from "@/lib/appointments/booking";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaff();
    const { id } = await params;
    const body = await req.json();
    const { status, cancelledReason } = body;

    const validStatuses = [
      "arrived",
      "in_consultation",
      "completed",
      "cancelled",
      "no_show",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const updated = await staffUpdateAppointmentStatus(id, status, cancelledReason);
    return NextResponse.json({ success: true, appointment: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
