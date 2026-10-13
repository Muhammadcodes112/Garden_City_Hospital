import { NotificationPayload } from "./types";
import { sendAppointmentSms } from "./sms";
import { sendAppointmentEmail } from "./email";

/**
 * Dispatches notifications asynchronously and safely without blocking booking transactions.
 */
export async function dispatchAppointmentNotification(
  payload: NotificationPayload,
  appointmentId?: string,
): Promise<void> {
  // Fire both in parallel, catching any errors so booking is NEVER blocked
  Promise.allSettled([
    // SMS notification
    (async () => {
      try {
        if (payload.patientPhone) {
          await sendAppointmentSms(
            payload.patientPhone,
            payload.type,
            payload.doctorName,
            payload.appointmentTime,
            appointmentId,
          );
        }
      } catch (err) {
        console.error("[Notification] SMS dispatch error:", err);
      }
    })(),

    // Email notification
    (async () => {
      try {
        if (payload.patientEmail) {
          await sendAppointmentEmail(
            payload.patientEmail,
            payload.type,
            payload.patientName,
            payload.doctorName,
            payload.appointmentTime,
          );
        }
      } catch (err) {
        console.error("[Notification] Email dispatch error:", err);
      }
    })(),
  ]).catch((err) => {
    console.error("[Notification] Unexpected dispatch failure:", err);
  });
}
