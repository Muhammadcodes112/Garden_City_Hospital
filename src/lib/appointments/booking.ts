import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, doctors } from "@/db/schema";
import { getNextAvailableSlots } from "./availability";
import { dispatchAppointmentNotification } from "@/lib/notifications";

export interface BookAppointmentInput {
  doctorId: string;
  startsAt: string; // UTC ISO string
  patientName: string;
  patientPhone: string;
  patientEmail?: string | null;
  reason?: string;
  note?: string;
  patientUserId?: string | null;
}

export interface BookingResult {
  success: boolean;
  code?: "OK" | "SLOT_TAKEN" | "TOO_SOON" | "NOT_FOUND" | "INVALID_INPUT";
  message?: string;
  appointment?: any;
  nextSlots?: { time: string; startsAt: string; dateStr: string }[];
}

export function isUniqueSlotViolation(err: any): boolean {
  if (!err) return false;
  if (err.code === "23505" || err.cause?.code === "23505") return true;
  if (
    err.constraint_name === "appointments_doctor_slot_unique_idx" ||
    err.cause?.constraint_name === "appointments_doctor_slot_unique_idx"
  ) {
    return true;
  }
  const str = `${err.message || ""} ${err.cause?.message || ""}`.toLowerCase();
  return (
    str.includes("appointments_doctor_slot_unique_idx") ||
    str.includes("duplicate key") ||
    str.includes("unique constraint")
  );
}

/**
 * Public Patient Appointment Booking
 * Enforces DB-level unique partial index check, 2-hour minimum lead time,
 * and catches unique collisions with friendly suggestions.
 */
export async function bookPublicAppointment(
  input: BookAppointmentInput,
): Promise<BookingResult> {
  const startsAtDate = new Date(input.startsAt);
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // 1. Refuse slot less than 2 hours away
  if (startsAtDate.getTime() < twoHoursFromNow.getTime()) {
    return {
      success: false,
      code: "TOO_SOON",
      message: "Appointments must be booked at least 2 hours in advance.",
    };
  }

  // 2. Fetch doctor for slot duration
  const doctor = await db.query.doctors.findFirst({
    where: eq(doctors.id, input.doctorId),
  });

  if (!doctor || !doctor.active) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "The selected doctor was not found or is currently unavailable.",
    };
  }

  const slotMinutes = doctor.slotMinutes || 30;
  const endsAtDate = new Date(startsAtDate.getTime() + slotMinutes * 60 * 1000);

  // 3. Attempt DB insert — relying on the partial unique index to prevent race conditions
  try {
    const [inserted] = await db
      .insert(appointments)
      .values({
        doctorId: doctor.id,
        patientUserId: input.patientUserId || null,
        patientName: input.patientName.trim(),
        patientPhone: input.patientPhone.trim(),
        patientEmail: input.patientEmail ? input.patientEmail.trim() : null,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        status: "booked",
        reason: input.reason ? input.reason.trim() : null,
        note: input.note ? input.note.trim() : null,
        bookedBy: "patient",
        bookedByUserId: input.patientUserId || null,
      })
      .returning();

    // 4. Non-blocking confirmation dispatch
    dispatchAppointmentNotification(
      {
        patientName: inserted.patientName,
        patientPhone: inserted.patientPhone,
        patientEmail: inserted.patientEmail,
        doctorName: doctor.fullName,
        appointmentTime: inserted.startsAt,
        type: "booking",
      },
      inserted.id,
    ).catch(() => {});

    return {
      success: true,
      code: "OK",
      appointment: inserted,
    };
  } catch (err: any) {
    // Check if Postgres threw a unique violation error (code 23505) directly or inside Drizzle error cause
    if (isUniqueSlotViolation(err)) {
      // Find the next 3 available slots to return friendly alternatives
      const nextSlots = await getNextAvailableSlots(doctor.id, startsAtDate, 3).catch(
        () => [],
      );

      return {
        success: false,
        code: "SLOT_TAKEN",
        message: "That time was just taken, here are the next three available slots:",
        nextSlots,
      };
    }

    console.error("Booking error:", err);
    throw err;
  }
}

/**
 * Staff / Front-Desk Booking (does not require the patient to have an account)
 */
export async function bookStaffAppointment(
  input: BookAppointmentInput & { staffUserId: string },
): Promise<BookingResult> {
  const startsAtDate = new Date(input.startsAt);

  const doctor = await db.query.doctors.findFirst({
    where: eq(doctors.id, input.doctorId),
  });

  if (!doctor || !doctor.active) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "The selected doctor was not found or is currently unavailable.",
    };
  }

  const slotMinutes = doctor.slotMinutes || 30;
  const endsAtDate = new Date(startsAtDate.getTime() + slotMinutes * 60 * 1000);

  try {
    const [inserted] = await db
      .insert(appointments)
      .values({
        doctorId: doctor.id,
        patientUserId: input.patientUserId || null,
        patientName: input.patientName.trim(),
        patientPhone: input.patientPhone.trim(),
        patientEmail: input.patientEmail ? input.patientEmail.trim() : null,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        status: "booked",
        reason: input.reason ? input.reason.trim() : null,
        note: input.note ? input.note.trim() : null,
        bookedBy: "staff",
        bookedByUserId: input.staffUserId,
      })
      .returning();

    dispatchAppointmentNotification(
      {
        patientName: inserted.patientName,
        patientPhone: inserted.patientPhone,
        patientEmail: inserted.patientEmail,
        doctorName: doctor.fullName,
        appointmentTime: inserted.startsAt,
        type: "booking",
      },
      inserted.id,
    ).catch(() => {});

    return {
      success: true,
      code: "OK",
      appointment: inserted,
    };
  } catch (err: any) {
    if (isUniqueSlotViolation(err)) {
      const nextSlots = await getNextAvailableSlots(doctor.id, startsAtDate, 3).catch(
        () => [],
      );
      return {
        success: false,
        code: "SLOT_TAKEN",
        message: "That time was just taken, here are the next three available slots:",
        nextSlots,
      };
    }
    throw err;
  }
}

/**
 * Patient cancels their own appointment
 * Enforces ownership check and 2-hour minimum lead time
 */
export async function cancelPatientAppointment(
  appointmentId: string,
  patientUserId: string,
  reason?: string,
): Promise<{ success: boolean; error?: string; status?: number }> {
  const appointment = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
    with: {
      // or join doctor manually
    },
  });

  if (!appointment) {
    return { success: false, error: "Appointment not found", status: 404 };
  }

  // Ownership verification
  if (appointment.patientUserId !== patientUserId) {
    return { success: false, error: "Forbidden: Not your appointment", status: 403 };
  }

  // 2-hour restriction check
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  if (appointment.startsAt.getTime() < twoHoursFromNow.getTime()) {
    return {
      success: false,
      error: "Appointments cannot be cancelled within 2 hours of the scheduled time.",
      status: 400,
    };
  }

  // Update status
  const [updated] = await db
    .update(appointments)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledReason: reason || "Cancelled by patient via portal",
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, appointmentId))
    .returning();

  // Doctor details for notice
  const doctor = await db.query.doctors.findFirst({
    where: eq(doctors.id, appointment.doctorId),
  });

  if (doctor) {
    dispatchAppointmentNotification(
      {
        patientName: updated.patientName,
        patientPhone: updated.patientPhone,
        patientEmail: updated.patientEmail,
        doctorName: doctor.fullName,
        appointmentTime: updated.startsAt,
        type: "cancellation",
      },
      updated.id,
    ).catch(() => {});
  }

  return { success: true };
}

/**
 * Patient reschedules their own appointment
 * Enforces ownership check, 2-hour lead time on current and new slots
 */
export async function reschedulePatientAppointment(
  appointmentId: string,
  patientUserId: string,
  newStartsAt: string,
): Promise<BookingResult> {
  const appointment = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
  });

  if (!appointment) {
    return { success: false, code: "NOT_FOUND", message: "Appointment not found" };
  }

  if (appointment.patientUserId !== patientUserId) {
    return { success: false, code: "NOT_FOUND", message: "Forbidden: Not your appointment" };
  }

  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // Cannot reschedule existing slot if < 2 hours away
  if (appointment.startsAt.getTime() < twoHoursFromNow.getTime()) {
    return {
      success: false,
      code: "TOO_SOON",
      message: "Appointments cannot be rescheduled within 2 hours of the appointment time.",
    };
  }

  const newStartsAtDate = new Date(newStartsAt);
  if (newStartsAtDate.getTime() < twoHoursFromNow.getTime()) {
    return {
      success: false,
      code: "TOO_SOON",
      message: "New appointment time must be at least 2 hours in advance.",
    };
  }

  const doctor = await db.query.doctors.findFirst({
    where: eq(doctors.id, appointment.doctorId),
  });

  if (!doctor) {
    return { success: false, code: "NOT_FOUND", message: "Doctor not found" };
  }

  const slotMinutes = doctor.slotMinutes || 30;
  const newEndsAtDate = new Date(newStartsAtDate.getTime() + slotMinutes * 60 * 1000);

  try {
    const [updated] = await db
      .update(appointments)
      .set({
        startsAt: newStartsAtDate,
        endsAt: newEndsAtDate,
        status: "booked", // reset to booked if it was rescheduled
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId))
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

    return {
      success: true,
      code: "OK",
      appointment: updated,
    };
  } catch (err: any) {
    if (isUniqueSlotViolation(err)) {
      const nextSlots = await getNextAvailableSlots(doctor.id, newStartsAtDate, 3).catch(
        () => [],
      );
      return {
        success: false,
        code: "SLOT_TAKEN",
        message: "That time was just taken, here are the next three available slots:",
        nextSlots,
      };
    }
    throw err;
  }
}

/**
 * Fetch patient's appointments (by session user ID only)
 */
export async function getPatientAppointments(patientUserId: string) {
  const userAppointments = await db
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
      bookedBy: appointments.bookedBy,
      createdAt: appointments.createdAt,
    })
    .from(appointments)
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .where(eq(appointments.patientUserId, patientUserId))
    .orderBy(desc(appointments.startsAt));

  return userAppointments;
}

/**
 * Staff update appointment status (arrived, in_consultation, completed, cancelled, no_show)
 */
export async function staffUpdateAppointmentStatus(
  appointmentId: string,
  status: "arrived" | "in_consultation" | "completed" | "cancelled" | "no_show",
  cancelledReason?: string,
) {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  if (status === "cancelled") {
    updateData.cancelledAt = new Date();
    updateData.cancelledReason = cancelledReason || "Cancelled by hospital staff";
  }

  const [updated] = await db
    .update(appointments)
    .set(updateData)
    .where(eq(appointments.id, appointmentId))
    .returning();

  return updated;
}
