import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/authz";
import { db } from "@/db";
import { appointments, doctors } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/patient/appointments/[id]
 * Patient A cannot read Patient B's appointment by changing an id.
 * Strictly verifies ownership against session user ID; returns 403 Forbidden.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;

    const [row] = await db
      .select({
        id: appointments.id,
        patientUserId: appointments.patientUserId,
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
        createdAt: appointments.createdAt,
      })
      .from(appointments)
      .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
      .where(eq(appointments.id, id));

    if (!row) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Ownership check: patient can ONLY read their own appointment
    if (row.patientUserId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: You cannot access another patient's appointment" },
        { status: 403 },
      );
    }

    return NextResponse.json({ appointment: row });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
