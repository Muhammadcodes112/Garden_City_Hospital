import { EmailProvider, EmailResult } from "./types";
import { formatLagosTime } from "../appointments/availability";

export class ResendEmailProvider implements EmailProvider {
  name = "resend";
  private apiKey: string;
  private fromEmail: string;

  constructor(apiKey?: string, fromEmail?: string) {
    this.apiKey = apiKey || process.env.RESEND_API_KEY || "";
    this.fromEmail = process.env.RESEND_FROM_EMAIL || "appointments@gardencityhospital.ng";
  }

  async sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<EmailResult> {
    if (!this.apiKey) {
      console.log(`[Email Dev Fallback] To: ${to} | Subject: ${subject}`);
      return { success: true, id: `mock-email-${Date.now()}` };
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to,
          subject,
          text,
          html: html || `<p>${text.replace(/\n/g, "<br>")}</p>`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || `Resend error ${res.status}` };
      }

      return { success: true, id: data.id };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to dispatch email via Resend" };
    }
  }
}

export const emailProvider: EmailProvider = new ResendEmailProvider();

export function buildEmailContent(
  type: "booking" | "reschedule" | "cancellation" | "reminder",
  patientName: string,
  doctorName: string,
  appointmentTimeUtc: Date,
): { subject: string; text: string; html: string } {
  const lagosTime = formatLagosTime(appointmentTimeUtc);
  const lagosDate = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(appointmentTimeUtc);

  let title = "Appointment Confirmed";
  let lead = `Your appointment with <strong>${doctorName}</strong> has been confirmed.`;
  let subject = `Garden City Hospital: Appointment Confirmed with ${doctorName}`;

  if (type === "reschedule") {
    title = "Appointment Rescheduled";
    lead = `Your appointment with <strong>${doctorName}</strong> has been rescheduled to a new time.`;
    subject = `Garden City Hospital: Appointment Rescheduled - ${doctorName}`;
  } else if (type === "cancellation") {
    title = "Appointment Cancelled";
    lead = `Your appointment with <strong>${doctorName}</strong> has been cancelled.`;
    subject = `Garden City Hospital: Appointment Cancelled - ${doctorName}`;
  } else if (type === "reminder") {
    title = "Appointment Reminder";
    lead = `This is a reminder for your upcoming appointment with <strong>${doctorName}</strong> tomorrow.`;
    subject = `Garden City Hospital: Reminder for your appointment tomorrow`;
  }

  const text = `Garden City Specialist Hospital
${title}

Dear ${patientName},

${lead.replace(/<[^>]+>/g, "")}

Date: ${lagosDate}
Time: ${lagosTime}
Doctor: ${doctorName}
Location: Garden City Specialist Hospital, Kaduna

Please arrive at least 15 minutes before your scheduled appointment time.
If you need to reschedule or cancel, please visit the patient portal at least 2 hours in advance.

Garden City Specialist Hospital
The Pathway to High-Quality and Affordable Health Care`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #086838; margin: 0; font-size: 22px;">Garden City Specialist Hospital</h2>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">The Pathway to High-Quality and Affordable Health Care</p>
      </div>

      <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #086838;">
        <h3 style="margin: 0 0 10px 0; color: #0f172a; font-size: 17px;">${title}</h3>
        <p style="margin: 0; color: #334155; font-size: 14px; line-height: 1.5;">${lead}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; width: 30%;">Date:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${lagosDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Time:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${lagosTime}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Doctor:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${doctorName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Hospital:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">Garden City Specialist Hospital, Kaduna</td>
        </tr>
      </table>

      <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 20px 0;">
        Please plan to arrive at the hospital reception 15 minutes prior to your consultation time.
      </p>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
        Garden City Specialist Hospital · Kaduna, Nigeria<br>
        Confidential Appointment Notice
      </div>
    </div>
  `;

  return { subject, text, html };
}

export async function sendAppointmentEmail(
  to: string,
  type: "booking" | "reschedule" | "cancellation" | "reminder",
  patientName: string,
  doctorName: string,
  appointmentTimeUtc: Date,
): Promise<EmailResult> {
  const { subject, text, html } = buildEmailContent(type, patientName, doctorName, appointmentTimeUtc);
  return emailProvider.sendEmail(to, subject, text, html);
}
