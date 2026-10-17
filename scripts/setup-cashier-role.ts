/**
 * One-time setup: creates the restricted Postgres role every cashier-area
 * query runs as (src/db/cashier.ts), following the same pattern as
 * scripts/setup-retention-role.ts.
 *
 * Why: the app's main role owns every table, and an owner bypasses
 * GRANT/REVOKE on its own objects, so "the cashier can't see clinical data"
 * can't be enforced on that connection — only by remembering to leave
 * columns out of queries. This role owns nothing, so its grants are real:
 *
 *   patients        SELECT on (id, surname, first_names, hospital_number, age, sex, phone) ONLY
 *                   — any query touching another patients column fails in Postgres.
 *   user            SELECT on (id, name) — to show who issued a receipt.
 *   services, service_categories          SELECT (the price list).
 *   cashier_shifts  SELECT, INSERT; UPDATE only of the closing columns (DB trigger freezes closed shifts).
 *   shift_reports   SELECT, INSERT (immutable snapshots).
 *   receipts        SELECT, INSERT; UPDATE (status, voided_by, voided_at, void_reason) only.
 *   receipt_lines, receipt_prints         SELECT, INSERT.
 *   receipt_no_seq  USAGE (nextval) — numbers come from the sequence only.
 *   activity_events INSERT (logging), no read.
 *
 * No access at all to form_records, vitals, medication charts, messages,
 * case_file_data or any other clinical table. DELETE is granted nowhere,
 * and receipts are additionally protected by DB triggers.
 *
 * Run once (after `npm run db:migrate`): npx tsx scripts/setup-cashier-role.ts
 * Prints a connection string — save it as CASHIER_DATABASE_URL in .env and
 * in Vercel's env vars. Re-running is safe: it re-applies grants and does
 * NOT print or rotate an existing role's password.
 */
import "dotenv/config";
import crypto from "crypto";
import postgres from "postgres";

const ROLE = "cashier_app";

function genPassword(): string {
  return crypto.randomBytes(24).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
}

const GRANTS = `
  GRANT USAGE ON SCHEMA public TO "${ROLE}";

  REVOKE ALL ON "patients" FROM "${ROLE}";
  GRANT SELECT ("id", "surname", "first_names", "hospital_number", "age", "sex", "phone") ON "patients" TO "${ROLE}";

  REVOKE ALL ON "user" FROM "${ROLE}";
  GRANT SELECT ("id", "name") ON "user" TO "${ROLE}";

  GRANT SELECT ON "service_categories", "services" TO "${ROLE}";

  GRANT SELECT, INSERT ON "cashier_shifts" TO "${ROLE}";
  GRANT UPDATE ("closed_at", "status", "expected_cash_kobo", "counted_cash_kobo", "variance_kobo", "closing_note", "report_sent_at") ON "cashier_shifts" TO "${ROLE}";
  GRANT SELECT, INSERT ON "shift_reports" TO "${ROLE}";

  GRANT SELECT, INSERT ON "receipts" TO "${ROLE}";
  GRANT UPDATE ("status", "voided_by", "voided_at", "void_reason") ON "receipts" TO "${ROLE}";

  GRANT SELECT, INSERT ON "receipt_lines", "receipt_prints" TO "${ROLE}";

  GRANT USAGE ON SEQUENCE "receipt_no_seq" TO "${ROLE}";

  GRANT INSERT ON "activity_events" TO "${ROLE}";
`;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, connect_timeout: 30, max: 1 });

  try {
    const existing = await sql`SELECT 1 FROM pg_roles WHERE rolname = ${ROLE}`;
    if (existing.length > 0) {
      console.log(`Role "${ROLE}" already exists — leaving its password untouched. Re-applying grants...`);
      await sql.unsafe(GRANTS);
      console.log("Done. If you've lost the password, drop the role and re-run this script to mint a new one.");
      return;
    }

    const password = genPassword();
    const [{ current_database: dbName }] = await sql<{ current_database: string }[]>`SELECT current_database()`;
    await sql.unsafe(`CREATE ROLE "${ROLE}" LOGIN PASSWORD '${password}'`);
    await sql.unsafe(`GRANT CONNECT ON DATABASE "${dbName}" TO "${ROLE}";`);
    await sql.unsafe(GRANTS);

    const dbUrl = new URL(process.env.DATABASE_URL);
    dbUrl.username = ROLE;
    dbUrl.password = password;

    console.log(`\nCreated role "${ROLE}" (cashier area: limited patient columns, receipts, shifts, price list).\n`);
    console.log("Save this as CASHIER_DATABASE_URL (.env and Vercel) — it will not be shown again:\n");
    console.log(dbUrl.toString());
    console.log("");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
