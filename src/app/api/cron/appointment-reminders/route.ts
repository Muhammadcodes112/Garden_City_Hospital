import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { appointments, doctors } from "@/db/schema";
import { lagosTimeToUtc, getLagosDateString } from "@/lib/appointments/availability";
import { dispatchAppointmentNotification } from "@/lib/notifications";
import { checkSmsBalanceAndAlertAdmins } from "@/lib/notifications/sms";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron Job: Runs at 18:00 WAT (17:00 UTC) every evening.
 * Sends SMS + Email reminders for tomorrow's appointments,
 * and checks the prepaid SMS balance against the threshold.
 */
export async function GET(req: NextRequest) {
  // Optional auth verification with CRON_SECRET
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Calculate tomorrow's window in Africa/Lagos WAT
    const nowUtc = new Date();
    // Add 24 hours to find tomorrow
    const tomorrowUtc = new Date(nowUtc.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowDateStr = getLagosDateString(tomorrowUtc);

    const tomorrowStartUtc = lagosTimeToUtc(tomorrowDateStr, "00:00");
    const tomorrowEndUtc = new Date(tomorrowStartUtc.getTime() + 24 * 60 * 60 * 1000);

    // 2. Query tomorrow's booked appointments
    const bookedTomorrow = await db
      .select({
        appointment: appointments,
        doctor: doctors,
      })
      .from(appointments)
      .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
      .where(
        and(
          eq(appointments.status, "booked"),
          gte(appointments.startsAt, tomorrowStartUtc),
          lte(appointments.startsAt, tomorrowEndUtc),
        ),
      );

    let remindersSent = 0;
    for (const { appointment, doctor } of bookedTomorrow) {
      await dispatchAppointmentNotification(
        {
          patientName: appointment.patientName,
          patientPhone: appointment.patientPhone,
          patientEmail: appointment.patientEmail,
          doctorName: doctor.fullName,
          appointmentTime: appointment.startsAt,
          type: "reminder",
        },
        appointment.id,
      );
      remindersSent++;
    }

    // 3. Check SMS balance and alert super admins if low
    const balanceInfo = await checkSmsBalanceAndAlertAdmins().catch(() => ({
      balance: 0,
      currency: "NGN",
    }));

    return NextResponse.json({
      success: true,
      remindersSent,
      targetDate: tomorrowDateStr,
      smsBalance: balanceInfo,
    });
  } catch (err: any) {
    console.error("Cron appointment reminders failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
