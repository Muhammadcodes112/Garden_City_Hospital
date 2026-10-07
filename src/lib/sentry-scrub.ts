/**
 * Strips patient- and message-identifying data from Sentry events before
 * they leave the process, in both directions:
 *  - by key name, wherever it appears in the event/breadcrumb object graph
 *    (covers patients.*, form_records.data, message bodies/notes, etc.)
 *  - by pattern, for values that look like this app's hospital number
 *    format even when found under an unrelated key (defense in depth).
 *
 * Must stay edge-runtime-safe (no Node-only APIs) — it's imported by the
 * server, edge, and client Sentry configs alike.
 */

const SENSITIVE_KEYS = new Set(
  [
    "surname",
    "firstNames",
    "firstName",
    "lastName",
    "patientName",
    "fullName",
    "name",
    "hospitalNumber",
    "xRayNumber",
    "dob",
    "phone",
    "address",
    "nextOfKinName",
    "nextOfKinRelationship",
    "nextOfKinPhone",
    "nextOfKinAddress",
    "placeOfOrigin",
    "tribe",
    "occupation",
    "religion",
    "bloodGroup",
    "genotype",
    "allergies",
    "data", // form_records.data JSONB — the entire form content
    "caseFileData",
    "searchText",
    "body", // message body
    "note", // send-to-colleague note
  ].map((k) => k.toLowerCase()),
);

// Matches this app's hospital number formats (e.g. "GCSH/2026/008") and
// Nigerian-style phone numbers, even inside an otherwise-unredacted string.
const HOSPITAL_NUMBER_PATTERN = /\b[A-Z]{2,}\/\d{4}\/\d+\b/g;
const PHONE_PATTERN = /\b(?:\+?234|0)\d{9,10}\b/g;

const REDACTED = "[redacted]";

function redactString(value: string): string {
  return value.replace(HOSPITAL_NUMBER_PATTERN, REDACTED).replace(PHONE_PATTERN, REDACTED);
}

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > 8) return REDACTED;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : scrubValue(val, depth + 1);
    }
    return out;
  }
  return value;
}

/** Applied in beforeSend — scrubs the whole event, and always drops request body/cookies outright. */
export function scrubEvent<T extends Record<string, unknown>>(event: T): T {
  const scrubbed = scrubValue(event, 0) as Record<string, unknown>;
  const request = scrubbed.request as Record<string, unknown> | undefined;
  if (request) {
    delete request.data;
    delete request.cookies;
  }
  // Breadcrumbs normally go through scrubBreadcrumb individually as they're
  // recorded, but re-apply the same console-message rule here too in case
  // any ever reach beforeSend without having passed through beforeBreadcrumb.
  if (Array.isArray(scrubbed.breadcrumbs)) {
    scrubbed.breadcrumbs = (scrubbed.breadcrumbs as Record<string, unknown>[]).map((b) =>
      b.category === "console" && typeof b.message === "string" ? { ...b, message: REDACTED } : b,
    );
  }
  return scrubbed as T;
}

/**
 * Applied in beforeBreadcrumb. Console breadcrumb messages are free-form
 * text written by our own console.log/error calls — there's no reliable
 * regex for an arbitrary human name, so pattern-matching alone can't
 * guarantee a patient's name never slips through (e.g. "Saving patient
 * Jane Doe" — "Jane Doe" isn't shaped like anything our patterns catch).
 * Dropping the message outright for console breadcrumbs is the only way to
 * make that an actual guarantee rather than a best effort; category/level
 * still make it to Sentry, which is enough to see that a log happened.
 */
export function scrubBreadcrumb<T extends Record<string, unknown>>(breadcrumb: T): T {
  const scrubbed = scrubValue(breadcrumb, 0) as T & { category?: string; message?: unknown };
  if (scrubbed.category === "console" && typeof scrubbed.message === "string") {
    scrubbed.message = REDACTED;
  }
  return scrubbed;
}
