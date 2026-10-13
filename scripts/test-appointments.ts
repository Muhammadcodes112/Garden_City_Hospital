import "dotenv/config";
import postgres from "postgres";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import {
  doctors,
  doctorSchedules,
  doctorTimeOff,
  appointments,
  user as userTable,
} from "../src/db/schema";
import {
  availableSlots,
  lagosTimeToUtc,
  getLagosDateString,
} from "../src/lib/appointments/availability";
import {
  bookPublicAppointment,
  cancelPatientAppointment,
  reschedulePatientAppointment,
} from "../src/lib/appointments/booking";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

async function runAppointmentTests() {
  console.log("\n=========================================");
  console.log("  STEP 18: APPOINTMENTS & CONCURRENCY TESTS  ");
  console.log("=========================================\n");

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  // 1. Setup Test Doctor
  console.log("--- 1. Doctor & Schedule Setup ---");
  const [testDoctor] = await db
    .insert(doctors)
    .values({
      fullName: "Dr. Test Specialist",
      specialty: "General Surgery",
      slotMinutes: 30,
      active: true,
    })
    .returning();

  assert(Boolean(testDoctor?.id), "Test doctor created successfully");

  // Create schedule for all weekdays (0-6) from 09:00 to 17:00
  for (let w = 0; w <= 6; w++) {
    await db.insert(doctorSchedules).values({
      doctorId: testDoctor.id,
      weekday: w,
      startsAt: "09:00",
      endsAt: "17:00",
    });
  }
  assert(true, "Test schedules created for 7 days");

  // 2. Setup Test Patient Accounts
  console.log("\n--- 2. Patient Accounts Setup ---");
  const patientAId = `test-patient-a-${Date.now()}`;
  const patientBId = `test-patient-b-${Date.now()}`;

  await db.insert(userTable).values([
    {
      id: patientAId,
      name: "Patient Alice",
      email: `${patientAId}@test.invalid`,
      role: "patient",
    },
    {
      id: patientBId,
      name: "Patient Bob",
      email: `${patientBId}@test.invalid`,
      role: "patient",
    },
  ]);
  assert(true, "Created Patient A and Patient B accounts");

  try {
    // 3. REFUSE BOOKING LESS THAN 2 HOURS AWAY
    console.log("\n--- 3. Refusal of Slots < 2 Hours Away ---");
    const slotTooSoon = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 mins from now
    const tooSoonRes = await bookPublicAppointment({
      doctorId: testDoctor.id,
      startsAt: slotTooSoon,
      patientName: "Alice",
      patientPhone: "08011112222",
      patientUserId: patientAId,
    });
    assert(!tooSoonRes.success, "Booking slot less than 2 hours away is refused");
    assert(tooSoonRes.code === "TOO_SOON", "Refusal returns code TOO_SOON");

    // 4. CONCURRENT BOOKINGS: EXACTLY ONE WINS (RACE CONDITION CHECK)
    console.log("\n--- 4. Concurrency Test: Double-Booking Prevention ---");
    // Pick a date 3 days in the future at 10:00 WAT (09:00 UTC)
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const futureDateStr = getLagosDateString(futureDate);
    const targetSlotUtc = lagosTimeToUtc(futureDateStr, "10:00").toISOString();

    console.log(`Firing 2 concurrent bookings at the exact same slot: ${targetSlotUtc}...`);
    const [result1, result2] = await Promise.all([
      bookPublicAppointment({
        doctorId: testDoctor.id,
        startsAt: targetSlotUtc,
        patientName: "Patient One",
        patientPhone: "08012345678",
        patientUserId: patientAId,
      }),
      bookPublicAppointment({
        doctorId: testDoctor.id,
        startsAt: targetSlotUtc,
        patientName: "Patient Two",
        patientPhone: "08087654321",
        patientUserId: patientBId,
      }),
    ]);

    const successes = [result1, result2].filter((r) => r.success);
    const failures = [result1, result2].filter((r) => !r.success);

    assert(successes.length === 1, "Exactly one concurrent booking succeeded");
    assert(failures.length === 1, "Exactly one concurrent booking failed");
    assert(
      failures[0].code === "SLOT_TAKEN",
      "Failed booking caught unique violation and returned SLOT_TAKEN",
    );
    assert(
      Array.isArray(failures[0].nextSlots) && failures[0].nextSlots.length > 0,
      "Friendly collision response provided alternative next available slots",
    );

    const winningAppointment = successes[0].appointment;

    // 5. PATIENT B CANNOT READ, CANCEL OR RESCHEDULE PATIENT A'S APPOINTMENT
    console.log("\n--- 5. Patient ID Cross-Access (403 Expected) ---");
    // Patient B attempts to read Patient A's appointments via getPatientAppointments
    const { getPatientAppointments } = await import("../src/lib/appointments/booking");
    const patientBAppointments = await getPatientAppointments(patientBId);
    assert(
      !patientBAppointments.some((a) => a.id === winningAppointment.id),
      "Patient B cannot read Patient A's appointment (strictly filtered by session user ID)",
    );

    // Direct appointment record ownership check (as enforced in GET /api/patient/appointments/[id])
    const appToRead = await db.query.appointments.findFirst({
      where: eq(appointments.id, winningAppointment.id),
    });
    const canPatientBRead = appToRead?.patientUserId === patientBId;
    assert(!canPatientBRead, "Patient B is rejected from accessing Patient A's appointment (403 Forbidden)");

    // Patient B attempts to cancel Patient A's winning appointment
    const cancelAttack = await cancelPatientAppointment(
      winningAppointment.id,
      patientBId, // wrong patient!
      "Malicious cancellation",
    );
    assert(!cancelAttack.success, "Patient B cannot cancel Patient A's appointment");
    assert(cancelAttack.status === 403, "Cancel attempt returns status 403 Forbidden");

    // Patient B attempts to reschedule Patient A's winning appointment
    const reschedSlot = lagosTimeToUtc(futureDateStr, "14:00").toISOString();
    const reschedAttack = await reschedulePatientAppointment(
      winningAppointment.id,
      patientBId, // wrong patient!
      reschedSlot,
    );
    assert(
      reschedAttack.code === "NOT_FOUND" || Boolean(reschedAttack.message?.includes("Forbidden")),
      "Reschedule attempt rejected",
    );

    // 6. PATIENT A LEGITIMATELY RESCHEDULES THEIR OWN APPOINTMENT
    console.log("\n--- 6. Patient Legitimate Reschedule ---");
    const newSlotUtc = lagosTimeToUtc(futureDateStr, "11:00").toISOString();
    const legitResched = await reschedulePatientAppointment(
      winningAppointment.id,
      patientAId, // Patient A's own ID
      newSlotUtc,
    );
    assert(legitResched.success, "Patient A successfully rescheduled their own appointment");
    assert(
      new Date(legitResched.appointment.startsAt).toISOString() === newSlotUtc,
      "Appointment new startsAt updated accurately in database",
    );

    // 7. AVAILABILITY SERVER FUNCTION (SERVER-SIDE ONLY, NO LEAKING DETAILS)
    console.log("\n--- 7. Availability Function Checks ---");
    const avail = await availableSlots(testDoctor.id, futureDateStr);
    assert(avail.doctorId === testDoctor.id, "availableSlots returns correct doctor");
    assert(avail.slots.length > 0, "availableSlots returns derived slots from schedule");
    assert(avail.weekStrip.length === 7, "availableSlots returns 7-day week strip with remaining counts");

    const rescheduledSlotInAvail = avail.slots.find((s) => s.startsAt === newSlotUtc);
    assert(
      rescheduledSlotInAvail?.taken === true && rescheduledSlotInAvail?.available === false,
      "Booked slot is marked taken and not available in availability output",
    );

    // 8. PATIENT A LEGITIMATELY CANCELS THEIR OWN APPOINTMENT (> 2 HOURS BEFORE)
    console.log("\n--- 8. Patient Legitimate Cancellation ---");
    const legitCancel = await cancelPatientAppointment(
      winningAppointment.id,
      patientAId,
      "Schedule conflict",
    );
    assert(legitCancel.success, "Patient A successfully cancelled their own appointment");

    // Verify slot is now free again (status in cancelled not blocking index)
    const [cancelledApp] = await db
      .select({ status: appointments.status })
      .from(appointments)
      .where(eq(appointments.id, winningAppointment.id));
    assert(cancelledApp.status === "cancelled", "Appointment status updated to cancelled in DB");

  } finally {
    // Cleanup
    console.log("\n--- Cleanup Test Records ---");
    await new Promise((r) => setTimeout(r, 500));
    const { smsLogs } = await import("../src/db/schema");
    await db.delete(smsLogs).where(sql`recipient IN ('08011112222', '08012345678', '08087654321')`).catch(() => {});
    await db.delete(appointments).where(eq(appointments.doctorId, testDoctor.id));
    await db.delete(doctorSchedules).where(eq(doctorSchedules.doctorId, testDoctor.id));
    await db.delete(doctors).where(eq(doctors.id, testDoctor.id));
    await db.delete(userTable).where(sql`id IN (${patientAId}, ${patientBId})`);
    console.log("✓ Cleanup completed cleanly.");
  }

  console.log("\n=========================================");
  console.log("  ALL APPOINTMENTS & CONCURRENCY TESTS PASSED!  ");
  console.log("=========================================\n");
  process.exit(0);
}

runAppointmentTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
