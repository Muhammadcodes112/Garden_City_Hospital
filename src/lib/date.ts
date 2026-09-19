const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formats a date (or ISO/date string) as DD/MM/YYYY. Returns "" for empty
 * input.
 *
 * Date-only strings ("2026-09-16", as returned by Postgres `date` columns)
 * are parsed by splitting the string rather than via `new Date()` — passing
 * that string to `Date` parses it as UTC midnight, and reading it back with
 * local getters can rewind it to the previous day whenever the server's
 * timezone is behind UTC. Full timestamps (createdAt/updatedAt) use UTC
 * getters for the same reason: display must not depend on the server's
 * local timezone.
 */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";

  if (typeof value === "string" && DATE_ONLY.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";

  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}
