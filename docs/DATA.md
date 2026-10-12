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
| Audit trail | `activity_events` | Who did what, when, to which record/conversation/account — snapshot names and roles, hashed IPs, user agents. Deliberately **excludes** message bodies and clinical note content. |
| Uploaded files | Vercel Blob (`messages/` prefix) | PDFs/images attached to messages — see [Step 14's privacy note] for why these are never exposed as public URLs |
| Activity archives | Vercel Blob (`activity-archives/` prefix) | Compressed monthly JSONL archives (`activity-events-YYYY-MM.jsonl.gz`) of audit events older than 90 days |
| Database backups | Vercel Blob (`backups/db/` prefix) | Full nightly dump of every table above — see `docs/RESTORE.md` |

## Who can access what

- **Any admin** (role `admin` or `super_admin`): every patient record and
  every form, across all patients — this system does not scope patients to
  the admin who created them. Can also attach/share records via Messages.
- **Super admins only**: the Admins tab (list of admins, promote/demote,
  soft-delete an admin account), the Activity tab (system-wide append-only
  audit trail with security signals and CSV streaming export), the rotating
  access-code settings, and permanent deletion of a patient record. See
  `/users`, `/activity`, and `requireSuperAdmin()` call sites.
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
| Activity log | 90 days live in `activity_events`. Weekly cron archives rows older than 90 days to compressed monthly JSONL files in Vercel Blob (`activity-archives/activity-events-YYYY-MM.jsonl.gz`), verifies line counts match, and only then purges archived rows. |
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

## Activity log archives (`activity-archives/`)

Audit events in `activity_events` are append-only. Rows are retained in the live
Postgres table for **90 days**.

### Archive schedule & verification
A weekly Vercel Cron job (`/api/cron/retention-activity-events`, running Sundays at 03:00 UTC)
archives events older than 90 days:
1. Groups events by calendar month: `activity-archives/activity-events-YYYY-MM.jsonl.gz`.
2. Encodes each event as a single JSON object per line (JSONL format) and compresses it with gzip (`level: 9`).
3. Uploads the compressed file to Vercel Blob storage.
4. Reads back the uploaded archive and confirms the decompressed line count matches the database row count exactly.
5. Only once verified, deletes those rows from PostgreSQL within an atomic transaction setting `SET LOCAL app.allow_retention_delete = 'true'` to satisfy the append-only trigger.

### Reading an archive file back
The archive files are permanent hospital records. To inspect an archived month:

Using standard CLI tools:
```bash
# 1. Inspect events line-by-line
curl -s "https://[BLOB_STORE_URL]/activity-archives/activity-events-2026-06.jsonl.gz" | gunzip | jq .

# 2. Count total rows archived in a month
curl -s "https://[BLOB_STORE_URL]/activity-archives/activity-events-2026-06.jsonl.gz" | gunzip | wc -l

# 3. Filter for specific actions (e.g. all deletions or failed sign-ins)
curl -s "https://[BLOB_STORE_URL]/activity-archives/activity-events-2026-06.jsonl.gz" | gunzip | grep "record.deleted" | jq .
```

Using Node.js:
```typescript
import fs from "fs";
import zlib from "zlib";
import readline from "readline";

const stream = fs.createReadStream("activity-events-2026-06.jsonl.gz").pipe(zlib.createGunzip());
const rl = readline.createInterface({ input: stream });

rl.on("line", (line) => {
  const event = JSON.parse(line);
  console.log(`${event.occurred_at} | ${event.actor_label} | ${event.action} | ${event.summary}`);
});
```

