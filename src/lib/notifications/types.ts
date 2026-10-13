export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsBalance {
  balance: number;
  currency: string;
}

export interface SmsProvider {
  name: string;
  sendSms(to: string, message: string): Promise<SmsResult>;
  getBalance(): Promise<SmsBalance>;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface EmailProvider {
  name: string;
  sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<EmailResult>;
}

export interface NotificationPayload {
  patientName: string;
  patientPhone: string;
  patientEmail?: string | null;
  doctorName: string;
  appointmentTime: Date; // UTC
  type: "booking" | "reschedule" | "cancellation" | "reminder";
}
