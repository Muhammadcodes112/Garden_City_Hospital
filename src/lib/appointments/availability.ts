import { and, eq, gte, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  doctors,
  doctorSchedules,
  doctorTimeOff,
  appointments,
} from "@/db/schema";

export * from "./types";
import {
  SlotInfo,
  DaySummary,
  AvailabilityResult,
  formatLagosTime,
  getLagosDateString,
  lagosTimeToUtc,
} from "./types";

/**
 * Derives available slots for a given doctor on a given date (in Africa/Lagos timezone).
 *
 * Rules:
 * - Derives slots from doctor's schedule for that weekday (0-6).
 * - Minus doctor time-off.
 * - Minus existing non-cancelled / non-no_show appointments.
 * - Minus any slot starting less than 2 hours from now.
 * - Returns remaining-count per day for the week strip.
 * - NEVER sends raw appointment details or names to the browser.
 */
export async function availableSlots(
  doctorId: string,
  dateStr: string,
): Promise<AvailabilityResult> {
  const doctor = await db.query.doctors.findFirst({
    where: eq(doctors.id, doctorId),
  });

  if (!doctor || !doctor.active) {
    throw new Error("Doctor not found or inactive");
  }

  const slotMinutes = doctor.slotMinutes || 30;
  const bufferMinutes = doctor.bufferMinutes || 0;
  const totalSlotDurationMs = (slotMinutes + bufferMinutes) * 60 * 1000;
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // Parse the target date to get day-of-week in Africa/Lagos (0 = Sunday ... 6 = Saturday)
  const targetDateMidday = new Date(`${dateStr}T12:00:00+01:00`);
  const weekday = targetDateMidday.getUTCDay(); // Lagos is +1, 12:00 is 11:00 UTC same day

  // Day window in UTC
  const dayStartUtc = lagosTimeToUtc(dateStr, "00:00");
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  // Fetch doctor's schedules
  const allSchedules = await db
    .select()
    .from(doctorSchedules)
    .where(eq(doctorSchedules.doctorId, doctorId));

  const targetDaySchedules = allSchedules.filter((s) => s.weekday === weekday);

  // Fetch existing appointments on target day
  const existingAppointments = await db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, doctorId),
        gte(appointments.startsAt, dayStartUtc),
        lte(appointments.startsAt, dayEndUtc),
        notInArray(appointments.status, ["cancelled", "no_show"]),
      ),
    );

  // Fetch time off overlapping target day
  const timeOffs = await db
    .select()
    .from(doctorTimeOff)
    .where(
      and(
        eq(doctorTimeOff.doctorId, doctorId),
        lte(doctorTimeOff.startsAt, dayEndUtc),
        gte(doctorTimeOff.endsAt, dayStartUtc),
      ),
    );

  // Generate slots for the target day
  const generatedSlots: SlotInfo[] = [];

  for (const schedule of targetDaySchedules) {
    const [startH, startM] = schedule.startsAt.split(":").map(Number);
    const [endH, endM] = schedule.endsAt.split(":").map(Number);

    let currentSlotUtc = lagosTimeToUtc(
      dateStr,
      `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
    );
    const scheduleEndUtc = lagosTimeToUtc(
      dateStr,
      `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
    );

    while (currentSlotUtc.getTime() + slotMinutes * 60 * 1000 <= scheduleEndUtc.getTime()) {
      const slotEndUtc = new Date(currentSlotUtc.getTime() + slotMinutes * 60 * 1000);

      // Check if slot starts less than 2 hours from now
      const isTooSoon = currentSlotUtc.getTime() < twoHoursFromNow.getTime();

      // Check if overlaps with time off
      const isTimeOff = timeOffs.some(
        (to) =>
          to.startsAt.getTime() < slotEndUtc.getTime() &&
          to.endsAt.getTime() > currentSlotUtc.getTime(),
      );

      // Check if already booked
      const isBooked = existingAppointments.some(
        (app) => Math.abs(app.startsAt.getTime() - currentSlotUtc.getTime()) < 60 * 1000,
      );

      const isAvailable = !isTooSoon && !isTimeOff && !isBooked;

      generatedSlots.push({
        time: formatLagosTime(currentSlotUtc),
        startsAt: currentSlotUtc.toISOString(),
        endsAt: slotEndUtc.toISOString(),
        available: isAvailable,
        taken: isBooked,
      });

      // Advance by slot + buffer
      currentSlotUtc = new Date(currentSlotUtc.getTime() + totalSlotDurationMs);
    }
  }

  // Sort slots chronologically
  generatedSlots.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  // Derive Week Strip (7 days starting from Monday of target week or today)
  const todayLagosStr = getLagosDateString(now);
  const weekStrip: DaySummary[] = [];

  // Anchor week strip around target date (from 3 days before to 3 days after, or 7 consecutive days starting from target/today)
  const anchorDate = new Date(`${dateStr}T12:00:00+01:00`);
  // Find Monday of the week
  const anchorWeekday = anchorDate.getUTCDay(); // 0 is Sun
  const mondayDiff = anchorWeekday === 0 ? -6 : 1 - anchorWeekday;
  const mondayDate = new Date(anchorDate);
  mondayDate.setUTCDate(anchorDate.getUTCDate() + mondayDiff);

  for (let i = 0; i < 7; i++) {
    const stripDate = new Date(mondayDate);
    stripDate.setUTCDate(mondayDate.getUTCDate() + i);
    const stripDateStr = getLagosDateString(stripDate);
    const stripWeekday = stripDate.getUTCDay();

    // Check schedules for this weekday
    const daySchedules = allSchedules.filter((s) => s.weekday === stripWeekday);

    let dayTotalSlots = 0;
    for (const sched of daySchedules) {
      const [sh, sm] = sched.startsAt.split(":").map(Number);
      const [eh, em] = sched.endsAt.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      dayTotalSlots += Math.floor((endMin - startMin) / (slotMinutes + bufferMinutes));
    }

    // If day is target date, we already computed exact remainingCount
    let dayRemaining = 0;
    if (stripDateStr === dateStr) {
      dayRemaining = generatedSlots.filter((s) => s.available).length;
    } else {
      // Fast calculate for other days in strip
      const stripStartUtc = lagosTimeToUtc(stripDateStr, "00:00");
      const stripEndUtc = new Date(stripStartUtc.getTime() + 24 * 60 * 60 * 1000);

      const dayBookedCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(appointments)
        .where(
          and(
            eq(appointments.doctorId, doctorId),
            gte(appointments.startsAt, stripStartUtc),
            lte(appointments.startsAt, stripEndUtc),
            notInArray(appointments.status, ["cancelled", "no_show"]),
          ),
        );

      const bookedCount = Number(dayBookedCount[0]?.count || 0);

      // Check if date is in the past
      if (stripDateStr < todayLagosStr) {
        dayRemaining = 0;
      } else {
        dayRemaining = Math.max(0, dayTotalSlots - bookedCount);
      }
    }

    const dayNameShort = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos",
      weekday: "short",
    }).format(stripDate);

    const dayNumber = Number(stripDateStr.split("-")[2]);

    weekStrip.push({
      date: stripDateStr,
      dayName: dayNameShort,
      dayNumber,
      isToday: stripDateStr === todayLagosStr,
      remainingCount: dayRemaining,
      totalSlots: dayTotalSlots,
    });
  }

  return {
    doctorId: doctor.id,
    doctorName: doctor.fullName,
    specialty: doctor.specialty,
    date: dateStr,
    slots: generatedSlots,
    weekStrip,
  };
}

/**
 * Finds the next N available slots for a doctor starting after a given timestamp.
 * Used when a collision occurs to suggest alternative times immediately!
 */
export async function getNextAvailableSlots(
  doctorId: string,
  afterDate: Date,
  limit: number = 3,
): Promise<{ time: string; startsAt: string; dateStr: string }[]> {
  const results: { time: string; startsAt: string; dateStr: string }[] = [];
  let currentDate = new Date(afterDate);

  // Search up to 7 days ahead
  for (let dayOffset = 0; dayOffset < 7 && results.length < limit; dayOffset++) {
    const checkDateStr = getLagosDateString(currentDate);
    try {
      const avail = await availableSlots(doctorId, checkDateStr);
      for (const slot of avail.slots) {
        if (slot.available && new Date(slot.startsAt).getTime() > afterDate.getTime()) {
          results.push({
            time: slot.time,
            startsAt: slot.startsAt,
            dateStr: checkDateStr,
          });
          if (results.length >= limit) break;
        }
      }
    } catch {
      // Ignore if day has no slots
    }
    // Next day
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return results;
}
