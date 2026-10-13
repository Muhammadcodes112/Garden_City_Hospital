import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { cancelPatientAppointment } from "@/lib/appointments/booking";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = body?.reason;

    const result = await cancelPatientAppointment(id, session.user.id, reason);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 400 },
      );
    }

    return NextResponse.json({ success: true, message: "Appointment cancelled." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
