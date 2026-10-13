export interface SlotInfo {
  time: string; // "09:00 AM" or "09:00" in Lagos time
  startsAt: string; // UTC ISO string
  endsAt: string; // UTC ISO string
  available: boolean;
  taken: boolean; // true if already booked by another patient
}

export interface DaySummary {
  date: string; // "YYYY-MM-DD"
  dayName: string; // "Mon", "Tue", ...
  dayNumber: number; // 12
  isToday: boolean;
  remainingCount: number;
  totalSlots: number;
}

export interface AvailabilityResult {
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string; // "YYYY-MM-DD"
  slots: SlotInfo[];
  weekStrip: DaySummary[];
}

/**
 * Format a Date to Africa/Lagos (WAT, UTC+1) time string (e.g. "09:00 AM")
 */
export function formatLagosTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Format a Date to Africa/Lagos date string "YYYY-MM-DD"
 */
export function getLagosDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

/**
 * Construct UTC Date from a Lagos date (YYYY-MM-DD) and Lagos time (HH:mm)
 * Africa/Lagos is strictly UTC+1 all year round (no DST).
 */
export function lagosTimeToUtc(dateStr: string, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const isoWithOffset = `${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+01:00`;
  return new Date(isoWithOffset);
}
