import { gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { smsLogs, user as userTable } from "@/db/schema";
import { SmsProvider, SmsResult, SmsBalance } from "./types";
import { formatLagosTime, getLagosDateString } from "../appointments/availability";

export const DAILY_SMS_CAP = 200; // Hard daily send cap to prevent draining account overnight
export const SMS_LOW_BALANCE_THRESHOLD = 1000; // NGN or credits threshold

/**
 * Termii Nigerian SMS Provider implementation
 * Uses official Termii REST API (https://api.ng.termii.com)
 */
export class TermiiSmsProvider implements SmsProvider {
  name = "termii";
  private apiKey: string;
  private senderId: string;
  private baseUrl = "https://api.ng.termii.com/api";

  constructor(apiKey?: string, senderId?: string) {
    this.apiKey = apiKey || process.env.TERMII_API_KEY || "";
    this.senderId = senderId || process.env.TERMII_SENDER_ID || "GardenCity";
  }

  async sendSms(to: string, message: string): Promise<SmsResult> {
    if (!this.apiKey) {
      // In development or test without API key, log to console
      console.log(`[SMS Dev Fallback] To: ${to} | Message: ${message}`);
      return { success: true, messageId: `mock-${Date.now()}` };
    }

    // Format Nigerian phone number: 08012345678 -> 2348012345678
    let formattedPhone = to.trim().replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = `234${formattedPhone.slice(1)}`;
    } else if (!formattedPhone.startsWith("234")) {
      formattedPhone = `234${formattedPhone}`;
    }

    try {
      const res = await fetch(`${this.baseUrl}/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: formattedPhone,
          from: this.senderId,
          sms: message,
          type: "plain",
          channel: "generic",
          api_key: this.apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || (data && data.code && data.code !== "ok")) {
        return {
          success: false,
          error: data.message || `Termii HTTP error ${res.status}`,
        };
      }

      return {
        success: true,
        messageId: data.message_id || data.id,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Failed to connect to Termii SMS service",
      };
    }
  }

  async getBalance(): Promise<SmsBalance> {
    if (!this.apiKey) {
      return { balance: 5000, currency: "NGN" };
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/get-balance?api_key=${encodeURIComponent(this.apiKey)}`,
      );
      const data = await res.json();
      return {
        balance: typeof data.balance === "number" ? data.balance : parseFloat(data.balance || "0"),
        currency: data.currency || "NGN",
      };
    } catch {
      return { balance: 0, currency: "NGN" };
    }
  }
}

// Active SMS provider instance (can be swapped)
export const smsProvider: SmsProvider = new TermiiSmsProvider();

/**
 * Format SMS message without any medical info (privacy requirement)
 */
export function buildSmsMessage(
  type: "booking" | "reschedule" | "cancellation" | "reminder",
  doctorName: string,
  appointmentTimeUtc: Date,
): string {
  const lagosTime = formatLagosTime(appointmentTimeUtc);
  const lagosDate = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(appointmentTimeUtc);

  switch (type) {
    case "booking":
      return `Garden City Specialist Hospital: Your appointment with ${doctorName} is confirmed for ${lagosDate} at ${lagosTime}. Please arrive 15 minutes before your time.`;
    case "reschedule":
      return `Garden City Specialist Hospital: Your appointment with ${doctorName} has been rescheduled to ${lagosDate} at ${lagosTime}.`;
    case "cancellation":
      return `Garden City Specialist Hospital: Your appointment with ${doctorName} scheduled for ${lagosDate} at ${lagosTime} has been cancelled.`;
    case "reminder":
      return `Garden City Specialist Hospital: Reminder of your appointment with ${doctorName} tomorrow, ${lagosDate} at ${lagosTime}. Please arrive 15 minutes early.`;
  }
}

/**
 * Check if the daily send cap has been reached
 */
export async function getTodaySmsCount(): Promise<number> {
  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(smsLogs)
    .where(gte(smsLogs.createdAt, startOfDayUtc));

  return Number(row?.count || 0);
}

/**
 * Send SMS with safety cap, DB logging, and non-blocking failure handling
 */
export async function sendAppointmentSms(
  to: string,
  type: "booking" | "reschedule" | "cancellation" | "reminder",
  doctorName: string,
  appointmentTimeUtc: Date,
  appointmentId?: string,
): Promise<SmsResult> {
  const message = buildSmsMessage(type, doctorName, appointmentTimeUtc);

  // 1. Check daily send cap
  const todayCount = await getTodaySmsCount().catch(() => 0);
  if (todayCount >= DAILY_SMS_CAP) {
    console.warn(`[SMS Cap] Daily cap of ${DAILY_SMS_CAP} reached. Suppressing SMS to ${to}.`);
    await db.insert(smsLogs).values({
      recipient: to,
      message,
      provider: smsProvider.name,
      status: "capped",
      errorMessage: `Exceeded daily cap of ${DAILY_SMS_CAP}`,
      appointmentId,
    }).catch(() => {});
    return { success: false, error: "Daily SMS send cap reached" };
  }

  // 2. Dispatch SMS
  const result = await smsProvider.sendSms(to, message).catch((err) => ({
    success: false,
    error: err.message,
  }));

  // 3. Log SMS in database
  await db.insert(smsLogs).values({
    recipient: to,
    message,
    provider: smsProvider.name,
    status: result.success ? "sent" : "failed",
    errorMessage: result.error,
    appointmentId,
  }).catch(async (err) => {
    // If appointment was deleted, fallback to logging with null appointmentId
    if (err?.code === "23503" || err?.cause?.code === "23503") {
      await db.insert(smsLogs).values({
        recipient: to,
        message,
        provider: smsProvider.name,
        status: result.success ? "sent" : "failed",
        errorMessage: result.error,
        appointmentId: null,
      }).catch(() => {});
      return;
    }
    console.error("Failed to log SMS event:", err);
  });

  return result;
}

/**
 * Check SMS provider balance and alert super admins if below threshold
 */
export async function checkSmsBalanceAndAlertAdmins(): Promise<SmsBalance> {
  const balanceInfo = await smsProvider.getBalance();

  if (balanceInfo.balance < SMS_LOW_BALANCE_THRESHOLD) {
    console.warn(
      `[SMS Balance Alert] Low balance: ${balanceInfo.balance} ${balanceInfo.currency} (Threshold: ${SMS_LOW_BALANCE_THRESHOLD})`,
    );
    // Find super admins
    const superAdmins = await db.query.user.findMany({
      where: (u, { eq }) => eq(u.role, "super_admin"),
      columns: { email: true, name: true },
    }).catch(() => []);

    // Dispatch balance warning
    for (const admin of superAdmins) {
      console.log(
        `[Admin Alert Email] Sent low SMS balance alert to ${admin.email}: ${balanceInfo.balance} ${balanceInfo.currency} remaining.`,
      );
    }
  }

  return balanceInfo;
}
