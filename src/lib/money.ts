/**
 * Money is stored as an integer number of kobo (₦1 = 100 kobo) in bigint
 * columns — never a float or decimal. These helpers are the only place that
 * converts between kobo and naira text, and they do it by string handling
 * rather than floating-point multiplication.
 */

/** Largest price accepted from a form: ₦100,000,000. */
export const MAX_PRICE_KOBO = 100_000_000 * 100;

/** 1200000 -> "₦12,000"; 1200050 -> "₦12,000.50". Display only. */
export function formatKobo(kobo: number): string {
  const sign = kobo < 0 ? "-" : "";
  const abs = Math.abs(kobo);
  const naira = Math.floor(abs / 100);
  const rem = abs % 100;
  const whole = naira.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}₦${whole}${rem ? `.${rem.toString().padStart(2, "0")}` : ""}`;
}

/** 1200000 -> "12000" (for prefilling an edit box); keeps kobo when present. */
export function koboToNairaInput(kobo: number): string {
  const naira = Math.floor(kobo / 100);
  const rem = kobo % 100;
  return rem ? `${naira}.${rem.toString().padStart(2, "0")}` : `${naira}`;
}

/**
 * Parses what a person types ("12,000", "₦12000", "12000.5") into kobo.
 * Returns null for anything that isn't a plain non-negative amount with at
 * most two decimal places.
 */
export function parseNairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const naira = Number(match[1]);
  const kobo = Number((match[2] ?? "").padEnd(2, "0"));
  const total = naira * 100 + kobo;
  return Number.isSafeInteger(total) ? total : null;
}
