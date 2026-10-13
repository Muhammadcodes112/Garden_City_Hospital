import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getPatientAppointments } from "@/lib/appointments/booking";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireUser();
    // Strictly fetch by the session user id — never by any parameter in the URL
    const appointmentsList = await getPatientAppointments(session.user.id);
    return NextResponse.json({ appointments: appointmentsList });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
