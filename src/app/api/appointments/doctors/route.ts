import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { doctors } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const activeDoctors = await db
      .select({
        id: doctors.id,
        fullName: doctors.fullName,
        specialty: doctors.specialty,
        slotMinutes: doctors.slotMinutes,
      })
      .from(doctors)
      .where(eq(doctors.active, true));

    return NextResponse.json({ doctors: activeDoctors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
