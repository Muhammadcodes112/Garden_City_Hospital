# Restoring the database from backup

This procedure has been tested end-to-end against the real production
database — see [Test record](#test-record-2026-10-05) at the bottom. An
untested backup is not a backup.

## How backups work

- `.github/workflows/backup-db.yml` runs daily at 01:00 UTC (02:00 WAT —
  off-peak for Nigeria) via GitHub Actions, plus on-demand via the Actions
  tab ("Run workflow").
- It runs a real `pg_dump` (via a `postgres:18-alpine` Docker container,
  matched to Neon's server major version) in PostgreSQL's custom format,
  which is compressed internally.
- The dump is uploaded to Vercel Blob at `backups/db/garden-city<random>.pgdump`.
- `scripts/backup-retention.mjs` then prunes old backups: keeps every
  backup from the last 30 days, plus the first backup of each calendar
  month for the last 12 months. Everything else is deleted.

### Why you won't find a backup URL anywhere in logs

**This GitHub repository is public**, which means every Actions log is
world-readable. Vercel Blob has no private-ACL concept — anyone holding a
backup's URL can download it, and a backup contains the *entire* patient
database. So:

- Backup blobs always get a random suffix (`addRandomSuffix: true`).
- The workflow and retention script never print a blob's pathname or url,
  only counts.
- The only way to find a specific backup's URL is to list them yourself,
  locally, using the `BLOB_READ_WRITE_TOKEN` secret (see below) — never via
  a CI log.

**Recommendation:** make this repository private. A public repo for
software holding real patient health information is a real exposure on its
own (full schema, security logic, and now a backup pipeline all world
-readable), independent of how carefully the blob access is scoped. This is
worth fixing before this system holds more real patient data.

## Required secrets

In the GitHub repo settings → Secrets and variables → Actions, add:

- `DATABASE_URL` — same value as your Neon connection string in `.env`.
- `BLOB_READ_WRITE_TOKEN` — same value as in `.env` / Vercel's env vars.

## Restoring a backup

You'll need [Docker](https://docker.com) installed locally, and the real
`BLOB_READ_WRITE_TOKEN` value (from `.env` or the Vercel dashboard).

### 1. List available backups and pick one

```bash
export BLOB_READ_WRITE_TOKEN=<the real token>
npx --yes -p @vercel/blob node -e "
  const { list } = require('@vercel/blob');
  (async () => {
    const { blobs } = await list({ prefix: 'backups/db/' });
    for (const b of blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))) {
      console.log(b.uploadedAt, b.url);
    }
  })();
"
```

This prints real backup URLs to your own terminal — never paste this output
anywhere public (a chat, an issue, a PR comment). Copy the URL of the backup
you want to restore.

### 2. Download it

```bash
curl -o /tmp/restore.pgdump "<the backup url you picked>"
```

### 3. Restore into a target database

**Into a scratch database (to verify a backup, or inspect old data) —**
spin up a throwaway local Postgres and restore into that, never into
anything shared:

```bash
docker run -d --name scratch-restore -e POSTGRES_PASSWORD=scratchpw \
  -e POSTGRES_DB=scratch -p 15432:5432 postgres:18-alpine

# wait a few seconds for it to come up, then:
docker cp /tmp/restore.pgdump scratch-restore:/tmp/restore.pgdump
docker exec scratch-restore pg_restore -U postgres -d scratch \
  --no-owner --no-privileges -v /tmp/restore.pgdump

# when done:
docker rm -f scratch-restore
```

**Into a real replacement database (actual disaster recovery) —** point
`pg_restore` at the new database's connection string instead of the local
scratch container:

```bash
docker run --rm -e TARGET_URL="<new database connection string>" \
  -v /tmp:/backup postgres:18-alpine \
  sh -c 'pg_restore -d "$TARGET_URL" --no-owner --no-privileges -v /backup/restore.pgdump'
```

This recreates every table, index, foreign key, and the
`messages_require_content_trigger` constraint trigger, then loads all rows.

### 4. Verify

Compare row counts between the restored database and what you expected
(the backup's age tells you how much data, if any, was created after it was
taken):

```bash
docker exec scratch-restore psql -U postgres -d scratch -c "
  SELECT table_name,
    (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I', table_name), false, true, '')))[1]::text::int AS cnt
  FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
  ORDER BY table_name;
"
```

Finally, point the app's `DATABASE_URL` at the restored database and
restart it.

## Test record (2026-10-05)

This exact procedure was run against the live production database to
confirm it actually works, then immediately torn down:

1. `pg_dump` via `postgres:18-alpine` against the real Neon `DATABASE_URL`
   → succeeded, produced a 96,845-byte custom-format dump.
2. A throwaway local `postgres:18-alpine` container was started as a
   scratch target.
3. `pg_restore` loaded the dump into it — every table, index, FK constraint,
   and the `messages_require_content_trigger` constraint trigger were
   recreated without errors.
4. Row counts were compared, table by table, source vs. restored:

   | table | source | restored |
   |---|---|---|
   | access_code_settings | 1 | 1 |
   | account | 5 | 5 |
   | activity_logs | 117 | 117 |
   | conversation_participants | 4 | 4 |
   | conversations | 2 | 2 |
   | failed_signups | 1 | 1 |
   | form_records | 35 | 35 |
   | message_attachments | 2 | 2 |
   | messages | 7 | 7 |
   | patients | 37 | 37 |
   | rate_limit | 3 | 3 |
   | session | 15 | 15 |
   | share_links | 12 | 12 |
   | two_factor | 0 | 0 |
   | user | 5 | 5 |
   | verification | 0 | 0 |

   Every table matched exactly.
5. The scratch container and the local dump file (which briefly held real
   patient data) were destroyed immediately after.

This confirms the dump/restore mechanics work. It does **not** yet confirm
the GitHub Actions workflow itself (A2) runs successfully in CI — add the
two repo secrets above, then trigger it once manually via "Run workflow"
and check it goes green before trusting the schedule.
