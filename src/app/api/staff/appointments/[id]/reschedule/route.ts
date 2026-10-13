import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/lib/authz";
import { db } from "@/db";
import { appointments, doctors } from "@/db/schema";
import { getNextAvailableSlots } from "@/lib/appointments/availability";
import { dispatchAppointmentNotification } from "@/lib/notifications";
import { isUniqueSlotViolation } from "@/lib/appointments/booking";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaff();
    const { id } = await params;
    const body = await req.json();
    const { startsAt } = body;

    if (!startsAt) {
      return NextResponse.json({ error: "New startsAt timestamp is required" }, { status: 400 });
    }

    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, id),
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    const doctor = await db.query.doctors.findFirst({
      where: eq(doctors.id, appointment.doctorId),
    });

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    const startsAtDate = new Date(startsAt);
    const endsAtDate = new Date(startsAtDate.getTime() + (doctor.slotMinutes || 30) * 60 * 1000);

    try {
      const [updated] = await db
        .update(appointments)
        .set({
          startsAt: startsAtDate,
          endsAt: endsAtDate,
          status: "booked",
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, id))
        .returning();

      dispatchAppointmentNotification(
        {
          patientName: updated.patientName,
          patientPhone: updated.patientPhone,
          patientEmail: updated.patientEmail,
          doctorName: doctor.fullName,
          appointmentTime: updated.startsAt,
          type: "reschedule",
        },
        updated.id,
      ).catch(() => {});

      return NextResponse.json({ success: true, appointment: updated });
    } catch (err: any) {
      if (isUniqueSlotViolation(err)) {
        const nextSlots = await getNextAvailableSlots(doctor.id, startsAtDate, 3).catch(
          () => [],
        );
        return NextResponse.json(
          {
            error: "That time was just taken, here are the next three available slots:",
            code: "SLOT_TAKEN",
            nextSlots,
          },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
