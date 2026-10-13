import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { requireStaff } from "@/lib/authz";
import { db } from "@/db";
import { appointments, doctors } from "@/db/schema";
import { lagosTimeToUtc, getLagosDateString } from "@/lib/appointments/availability";
import { bookStaffAppointment } from "@/lib/appointments/booking";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireStaff();

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date") || getLagosDateString();
    const doctorId = searchParams.get("doctorId");

    const dayStartUtc = lagosTimeToUtc(dateStr, "00:00");
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

    const conditions = [
      gte(appointments.startsAt, dayStartUtc),
      lte(appointments.startsAt, dayEndUtc),
    ];

    if (doctorId && doctorId !== "all") {
      conditions.push(eq(appointments.doctorId, doctorId));
    }

    const dayAppointments = await db
      .select({
        id: appointments.id,
        patientName: appointments.patientName,
        patientPhone: appointments.patientPhone,
        patientEmail: appointments.patientEmail,
        doctorId: appointments.doctorId,
        doctorName: doctors.fullName,
        specialty: doctors.specialty,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        status: appointments.status,
        reason: appointments.reason,
        note: appointments.note,
        bookedBy: appointments.bookedBy,
        bookedByUserId: appointments.bookedByUserId,
        createdAt: appointments.createdAt,
        cancelledAt: appointments.cancelledAt,
        cancelledReason: appointments.cancelledReason,
      })
      .from(appointments)
      .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
      .where(and(...conditions))
      .orderBy(appointments.startsAt);

    return NextResponse.json({ appointments: dayAppointments, date: dateStr });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaff();
    const body = await req.json();
    const { doctorId, startsAt, patientName, patientPhone, patientEmail, reason, note } = body;

    if (!doctorId || !startsAt || !patientName || !patientPhone) {
      return NextResponse.json(
        { error: "Doctor, time, patient name, and phone number are required." },
        { status: 400 },
      );
    }

    const result = await bookStaffAppointment({
      doctorId,
      startsAt,
      patientName,
      patientPhone,
      patientEmail,
      reason,
      note,
      staffUserId: session.user.id,
    });

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

    return NextResponse.json({ success: true, appointment: result.appointment });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
