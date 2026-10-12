/**
 * One-time setup: creates a dedicated, minimally-privileged Postgres role
 * for the weekly activity_events retention job (scripts/retention-activity-events.ts).
 *
 * Why a separate role at all, given the app's main role (neondb_owner) owns
 * every table and therefore bypasses GRANT/REVOKE on its own objects (table
 * ownership always wins over ACLs in Postgres — revoking from the owner
 * role would be a no-op, not real enforcement)? Because this NEW role does
 * NOT own anything. Its grants are real: SELECT + a narrow DELETE on
 * activity_events only, nothing else in the database. If this credential
 * ever leaks, the blast radius is "read and prune one append-only log
 * table" — not the whole database the app's main connection can reach.
 *
 * Run once: npx tsx scripts/setup-retention-role.ts
 * Prints a connection string — save it as ACTIVITY_RETENTION_DATABASE_URL
 * in .env and in Vercel's env vars. Re-running is safe (idempotent); it
 * will NOT print a new password for an already-existing role, since it
 * doesn't know the existing one and won't silently rotate it.
 */
import "dotenv/config";
import crypto from "crypto";
import postgres from "postgres";

const ROLE = "activity_retention";

function genPassword(): string {
  // Alphanumeric only — sidesteps any SQL-quoting/shell-escaping edge cases
  // for a value that's about to be interpolated into DDL and printed raw.
  return crypto.randomBytes(24).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, connect_timeout: 30, max: 1 });

  try {
    const existing = await sql`SELECT 1 FROM pg_roles WHERE rolname = ${ROLE}`;
    if (existing.length > 0) {
      console.log(`Role "${ROLE}" already exists — leaving its password untouched.`);
      console.log("Re-applying grants (idempotent) in case the schema changed since it was created...");
      await sql.unsafe(`
        GRANT USAGE ON SCHEMA public TO "${ROLE}";
        GRANT SELECT, DELETE ON "activity_events" TO "${ROLE}";
        REVOKE INSERT, UPDATE, TRUNCATE ON "activity_events" FROM "${ROLE}";
      `);
      console.log("Done. If you've lost the password, drop and re-run this script to mint a new one.");
      return;
    }

    const password = genPassword();
    const [{ current_database: dbName }] = await sql<{ current_database: string }[]>`SELECT current_database()`;
    await sql.unsafe(`CREATE ROLE "${ROLE}" LOGIN PASSWORD '${password}'`);
    await sql.unsafe(`
      GRANT CONNECT ON DATABASE "${dbName}" TO "${ROLE}";
      GRANT USAGE ON SCHEMA public TO "${ROLE}";
      GRANT SELECT, DELETE ON "activity_events" TO "${ROLE}";
    `);

    const dbUrl = new URL(process.env.DATABASE_URL);
    dbUrl.username = ROLE;
    dbUrl.password = password;
    const connectionString = dbUrl.toString();

    console.log(`\nCreated role "${ROLE}" with SELECT + DELETE on activity_events only.\n`);
    console.log("Save this as ACTIVITY_RETENTION_DATABASE_URL (.env and Vercel) — it will not be shown again:\n");
    console.log(connectionString);
    console.log("");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
