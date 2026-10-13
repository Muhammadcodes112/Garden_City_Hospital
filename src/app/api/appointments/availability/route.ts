import { NextRequest, NextResponse } from "next/server";
import { availableSlots, getLagosDateString } from "@/lib/appointments/availability";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  const dateStr = searchParams.get("date") || getLagosDateString();

  if (!doctorId) {
    return NextResponse.json({ error: "doctorId is required" }, { status: 400 });
  }

  try {
    const availability = await availableSlots(doctorId, dateStr);
    return NextResponse.json(availability);
  } catch (err: any) {
    console.error("Availability query failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to derive availability" },
      { status: 400 },
    );
  }
}
