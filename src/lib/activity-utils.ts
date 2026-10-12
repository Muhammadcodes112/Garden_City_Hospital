/**
 * Activity log pure formatting and parsing utilities.
 * Usable across server, client, and CLI scripts without server-only dependencies.
 */

/** Formats a timestamp into DD/MM/YYYY HH:mm:ss in Africa/Lagos (WAT, UTC+1). */
export function formatLagosDateTime(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/** Parses user agent into clean friendly browser + OS string. */
export function parseUserAgent(ua: string | null): string {
  if (!ua) return "Unknown Client";
  if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone")) {
    if (ua.includes("iPhone") || ua.includes("iPad")) return "Safari on iOS";
    if (ua.includes("Android")) return "Chrome on Android";
    return "Mobile Browser";
  }
  if (ua.includes("Edg/")) return "Edge on Windows";
  if (ua.includes("Chrome/")) {
    if (ua.includes("Macintosh")) return "Chrome on macOS";
    if (ua.includes("Windows")) return "Chrome on Windows";
    return "Chrome on Windows";
  }
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) {
    if (ua.includes("Macintosh")) return "Safari on macOS";
    return "Safari";
  }
  if (ua.includes("Firefox/")) return "Firefox";
  return "Desktop Browser";
}

/** Determines if occurredAt falls between 22:00 and 06:00 Africa/Lagos (WAT, UTC+1). */
export function isAfterHoursLagos(dateInput: Date | string): boolean {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const hourPart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "numeric",
    hour12: false,
  }).format(date);
  const hour = parseInt(hourPart, 10);
  return hour >= 22 || hour < 6;
}

/** Shallow count of top-level keys whose JSON-serialized value differs between two form-data objects. */
export function countChangedFields(before: Record<string, unknown>, after: Record<string, unknown>): number {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  let count = 0;
  for (const key of keys) {
    if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) count++;
  }
  return count;
}
