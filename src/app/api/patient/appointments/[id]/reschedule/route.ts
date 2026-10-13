import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { reschedulePatientAppointment } from "@/lib/appointments/booking";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const body = await req.json();
    const { startsAt } = body;

    if (!startsAt) {
      return NextResponse.json({ error: "New start time is required" }, { status: 400 });
    }

    // Verify ownership directly first
    const app = await db.query.appointments.findFirst({
      where: eq(appointments.id, id),
    });

    if (!app) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    if (app.patientUserId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden: Not your appointment" }, { status: 403 });
    }

    const result = await reschedulePatientAppointment(id, session.user.id, startsAt);

    if (!result.success) {
      if (result.code === "SLOT_TAKEN") {
        return NextResponse.json(
          {
            error: result.message,
            code: "SLOT_TAKEN",
            nextSlots: result.nextSlots || [],
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      appointment: result.appointment,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
