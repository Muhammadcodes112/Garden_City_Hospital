/**
 * Cash-desk control thresholds (Step 22). Change them here; every check,
 * flag and label reads from these.
 */

/** An open shift older than this is flagged to Super Admins: someone forgot to close it. */
export const STALE_SHIFT_HOURS = 16;

/** A cashier can void their own receipt only within this many hours of issuing it (and only in their open shift). */
export const CASHIER_VOID_WINDOW_HOURS = 2;

/** More voids than this in one shift is highlighted for management. */
export const SHIFT_VOID_ALERT_THRESHOLD = 3;

export function isWithinCashierVoidWindow(issuedAt: Date | string, now = new Date()): boolean {
  return now.getTime() - new Date(issuedAt).getTime() <= CASHIER_VOID_WINDOW_HOURS * 3_600_000;
}

/** "₦1,500 short" / "₦500 over" / "Balanced", given variance = counted − expected (kobo). */
export function describeVariance(varianceKobo: number, format: (kobo: number) => string): string {
  if (varianceKobo === 0) return "Balanced";
  return varianceKobo < 0 ? `${format(-varianceKobo)} short` : `${format(varianceKobo)} over`;
}
