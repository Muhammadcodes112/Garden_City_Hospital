/**
 * How long a soft-deleted (Trash) record is kept before
 * /api/cron/cleanup-trash permanently deletes it. Documented here — and in
 * docs/DATA.md for NDPA purposes — rather than left as a magic number in
 * the cron route.
 *
 * Changing this value changes real retention behavior for patient data;
 * update docs/DATA.md's retention table in the same change.
 */
export const TRASH_RETENTION_DAYS = 30;
