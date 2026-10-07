# Data handling — Garden City Specialist Hospital admin system

Plain statement of what personal data this system stores, where, who can
reach it, how long it's kept, and how it's deleted. Written for Nigeria Data
Protection Act (NDPA) compliance review — if anything here looks wrong,
that's a bug in the system, not just the doc.

## ⚠ Cross-border data transfer

**Patient and admin data is currently hosted outside Nigeria.** The
database (Neon Postgres) is in AWS `us-east-1` (Northern Virginia, USA).
File attachments (Vercel Blob) and the application itself (Vercel) default
to US regions unless explicitly reconfigured in each dashboard — nothing in
this repo pins a region.

The NDPA restricts transferring Nigerians' personal data outside Nigeria
unless an adequate safeguard applies (an adequacy decision, approved
contractual clauses with the processor, or another recognized basis under
the Act, administered by the Nigeria Data Protection Commission). **This
needs a legal/compliance review before this system holds more real patient
data** — it is not something code changes alone can fix; it is a hosting
and contractual decision.

## What personal data is stored, and where

| Data | Table(s) | Contains |
|---|---|---|
| Patient identity & demographics | `patients` | Name, DOB, sex, phone, address, hospital number, next-of-kin contact, blood group, genotype, allergies, tribe, religion, occupation |
| Clinical form content | `form_records.data` (JSONB) | Full lab request / prescription / medical report content — diagnoses, drugs, test results, clinical notes. Keyed to a patient via `patient_id`. |
| Admin accounts | `user`, `account`, `session`, `two_factor` | Name, email, password hash, 2FA secret/backup codes, session tokens |
| Internal messages | `messages`, `message_attachments` | Free-text message bodies between admins (may reference or discuss patient cases), plus attached file uploads, record references, or share links |
| Public share links | `share_links` | A random token + expiry; the token alone grants access to one record's rendered document, no login required |
| Audit trail | `activity_logs` | Who did what, when, to which record/conversation — deliberately **excludes** message content and form content (see Messages design) |
| Uploaded files | Vercel Blob (`messages/` prefix) | PDFs/images attached to messages — see [Step 14's privacy note] for why these are never exposed as public URLs |
| Database backups | Vercel Blob (`backups/db/` prefix) | Full nightly dump of every table above — see `docs/RESTORE.md` |

## Who can access what

- **Any admin** (role `admin` or `super_admin`): every patient record and
  every form, across all patients — this system does not scope patients to
  the admin who created them. Can also attach/share records via Messages.
- **Super admins only**: the Admins tab (list of admins, promote/demote,
  soft-delete an admin account), the rotating access-code settings, and
  permanent deletion of a patient record. See `/admins` page and
  `requireSuperAdmin()` call sites.
- **Nobody, by design**: a super admin cannot read another admin's message
  contents — no admin inbox, no cross-user message search exists. The
  activity log records that a message was sent (who, when, which
  conversation) but never its content. See `src/lib/actions/messages.ts`.
- **Whoever holds a share link's token**: that one record's rendered
  document, no account needed, until the link expires or is revoked.
- **Whoever holds a backup blob's URL**: the entire database. Vercel Blob
  has no private-ACL concept, so this is gated entirely by keeping the
  `BLOB_READ_WRITE_TOKEN` secret and never logging a backup's URL (see
  `docs/RESTORE.md`) — treat that token as highly sensitive.
- **Sentry** (once a real DSN is configured): error reports and
  breadcrumbs, with patient names, hospital numbers, form data, and message
  bodies stripped before leaving the process — see `src/lib/sentry-scrub.ts`.
  This scrubbing is pattern- and key-based, not a formal guarantee; a
  caught error's own `.message` string could in principle still contain a
  value a developer interpolated into it (none currently do, per a
  deliberate audit of every `console.error`/`console.log` call in this
  codebase as of 2026-10).

## Retention

| Data | Retention |
|---|---|
| Patient records & form content | Indefinite, until a Super Admin soft-deletes it |
| Soft-deleted ("Trash") records | `TRASH_RETENTION_DAYS` (`src/lib/retention.ts`, currently 30 days) after soft-deletion, then permanently deleted by `/api/cron/cleanup-trash` |
| A Super Admin's immediate "Delete" on a patient (not via Trash) | Deletes the patient and all their form records **immediately**, no grace period — see `DELETE /api/patients/[id]` |
| Messages & attachments | Indefinite. A sender can soft-delete their own message (hides content, row persists) — there is no bulk/automatic message purge |
| Share links | Indefinite as database rows, even after they expire or are revoked — only the *token's ability to fetch a document* ends, not the row |
| Activity log | Indefinite — no purge mechanism exists |
| Database backups | 30 days daily, plus the first backup of each month for 12 months — see `scripts/backup-retention.mjs` |
| Admin sessions | Per Better Auth's session expiry config (framework default) |

## How a record is permanently deleted

Two different paths exist, with different grace periods — worth knowing
which one is in play:

1. **Soft-delete → Trash → cron purge** (the normal path, any form record):
   a Super Admin soft-deletes a lab/prescription/medical-report record
   (`softDeleteRecord` in `src/lib/actions/records-actions.ts`), which also
   immediately revokes its share links. It sits in Trash, visible only to
   Super Admins, for `TRASH_RETENTION_DAYS`. After that,
   `/api/cron/cleanup-trash` deletes the `form_records` row and its
   `share_links` rows outright, and deletes any cached PDF preview images
   from disk.
2. **Immediate patient deletion** (`DELETE /api/patients/[id]`, Super Admin
   only): deletes the `patients` row and **all** of their `form_records`
   rows immediately — no Trash, no grace period. Use with that in mind.

Neither path currently cleans up `messages`/`message_attachments` rows that
reference a deleted record — an attachment card for a deleted record
degrades to "This record is no longer available" (checked live, not
cached), but the message row and the fact that it was once shared remain.
