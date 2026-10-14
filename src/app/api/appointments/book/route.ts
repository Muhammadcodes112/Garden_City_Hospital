import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { bookPublicAppointment } from "@/lib/appointments/booking";
import { NIGERIAN_PHONE_MESSAGE, isValidNigerianPhone } from "@/lib/validators/phone";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { doctorId, startsAt, patientName, patientPhone, patientEmail, reason } = body;

    if (!doctorId || !startsAt || !patientName || !patientPhone) {
      return NextResponse.json(
        { error: "Doctor, date/time, patient name, and phone number are required." },
        { status: 400 },
      );
    }

    if (!isValidNigerianPhone(patientPhone)) {
      return NextResponse.json({ error: NIGERIAN_PHONE_MESSAGE }, { status: 400 });
    }

    // Check optional session for logged-in patient
    const session = await getSession();
    const patientUserId = session?.user?.id || null;

    const result = await bookPublicAppointment({
      doctorId,
      startsAt,
      patientName,
      patientPhone,
      patientEmail,
      reason,
      patientUserId,
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

      if (result.code === "TOO_SOON") {
        return NextResponse.json(
          {
            error: result.message,
            code: "TOO_SOON",
          },
          { status: 400 },
        );
      }

      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      appointment: result.appointment,
    });
  } catch (err: any) {
    console.error("Booking API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process appointment booking." },
      { status: 500 },
    );
  }
}
