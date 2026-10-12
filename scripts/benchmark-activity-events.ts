import "dotenv/config";
import postgres from "postgres";

async function runBenchmark() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

  try {
    console.log("=== STEP 17 BENCHMARK: 200,000 SYNTHETIC ROWS & QUERY TIMINGS ===");

    // Check current count
    const [countRow] = await sql`SELECT count(*)::bigint as total FROM activity_events;`;
    const currentCount = Number(countRow.total);
    console.log(`Current rows in activity_events: ${currentCount.toLocaleString()}`);

    const targetRows = 200000;
    const needed = targetRows - currentCount;

    if (needed > 0) {
      console.log(`Generating ${needed.toLocaleString()} synthetic rows via PostgreSQL generate_series()...`);
      const genStart = performance.now();

      await sql.unsafe(`
        INSERT INTO activity_events (
          occurred_at,
          actor_id,
          actor_role_at_time,
          actor_label,
          category,
          action,
          target_type,
          target_id,
          summary,
          ip_hash,
          user_agent,
          metadata
        )
        SELECT
          -- Spread dates over last 120 days, with 30% happening today
          CASE
            WHEN s % 3 = 0 THEN now() - (interval '1 second' * (s % 86400))
            ELSE now() - (interval '1 hour' * (s % 2880))
          END AS occurred_at,
          CASE (s % 5)
            WHEN 0 THEN 'usr_super_admin'
            WHEN 1 THEN 'usr_doctor_adebayo'
            WHEN 2 THEN 'usr_doctor_eze'
            WHEN 3 THEN 'usr_nurse_chioma'
            ELSE NULL -- e.g. failed sign-ins have no actor
          END AS actor_id,
          CASE (s % 5)
            WHEN 0 THEN 'super_admin'::user_role
            WHEN 1 THEN 'admin'::user_role
            WHEN 2 THEN 'admin'::user_role
            WHEN 3 THEN 'admin'::user_role
            ELSE NULL
          END AS actor_role_at_time,
          CASE (s % 5)
            WHEN 0 THEN 'Super Admin'
            WHEN 1 THEN 'Dr. Adebayo Ogunlesi'
            WHEN 2 THEN 'Dr. Ngozi Eze'
            WHEN 3 THEN 'Nurse Chioma Obi'
            ELSE 'Anonymous Guest'
          END AS actor_label,
          CASE (s % 6)
            WHEN 0 THEN 'auth'::activity_category
            WHEN 1 THEN 'records'::activity_category
            WHEN 2 THEN 'sharing'::activity_category
            WHEN 3 THEN 'messages'::activity_category
            WHEN 4 THEN 'appointments'::activity_category
            ELSE 'accounts'::activity_category
          END AS category,
          CASE (s % 12)
            WHEN 0 THEN 'signin'
            WHEN 1 THEN 'signin.failed'
            WHEN 2 THEN 'record.created'
            WHEN 3 THEN 'record.edited'
            WHEN 4 THEN 'record.completed'
            WHEN 5 THEN 'record.deleted'
            WHEN 6 THEN 'link.created'
            WHEN 7 THEN 'link.opened'
            WHEN 8 THEN 'pdf.downloaded'
            WHEN 9 THEN 'message.sent'
            WHEN 10 THEN 'role.changed'
            ELSE 'access_code.regenerated'
          END AS action,
          CASE (s % 4)
            WHEN 0 THEN 'form_record'
            WHEN 1 THEN 'patient'
            WHEN 2 THEN 'conversation'
            ELSE 'user'
          END AS target_type,
          gen_random_uuid()::text AS target_id,
          CASE (s % 12)
            WHEN 0 THEN 'Signed in successfully via email/password'
            WHEN 1 THEN 'Failed sign-in attempt for attempted_user_' || (s % 100) || '@gmail.com'
            WHEN 2 THEN 'Created a new laboratory request form'
            WHEN 3 THEN 'Edited prescription form (3 fields changed)'
            WHEN 4 THEN 'Marked medical report as completed'
            WHEN 5 THEN 'Deleted patient form record and revoked share links'
            WHEN 6 THEN 'Created 7-day secure public share link'
            WHEN 7 THEN 'Shared record link was opened by recipient'
            WHEN 8 THEN 'Downloaded official clinical record PDF'
            WHEN 9 THEN 'Sent internal consultation message'
            WHEN 10 THEN 'Changed user role from admin to super_admin (promoted)'
            ELSE 'Regenerated hospital emergency access code'
          END AS summary,
          md5('salt_ip_' || (s % 500)) AS ip_hash,
          CASE (s % 3)
            WHEN 0 THEN 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0'
            WHEN 1 THEN 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/17.2'
            ELSE 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
          END AS user_agent,
          jsonb_build_object(
            'batch', s % 100,
            'source', 'benchmark_synth',
            'changedFields', (s % 7),
            'ipAddress', '197.210.' || (s % 255) || '.' || (s % 255)
          ) AS metadata
        FROM generate_series(1, ${needed}) AS s;
      `);

      const genDuration = performance.now() - genStart;
      console.log(`Generated ${needed.toLocaleString()} rows in ${(genDuration / 1000).toFixed(2)}s.`);

      // Update statistics
      console.log("Analyzing activity_events table for optimal query planner statistics...");
      await sql`ANALYZE activity_events;`;
    }

    const [finalCountRow] = await sql`SELECT count(*)::bigint as total FROM activity_events;`;
    console.log(`Total rows in activity_events now: ${Number(finalCountRow.total).toLocaleString()}\n`);

    // Warm up database connection pool
    console.log("Warming up database connection pool...");
    await sql`SELECT 1;`;

    // ==========================================
    // BENCHMARK 1: Activity Page Keyset Load
    // ==========================================
    console.log("--- TEST 1: KEYSET PAGINATION (PAGE 1 - 50 ROWS) ---");

    const explainKeyset = await sql`
      EXPLAIN (ANALYZE, TIMING)
      SELECT
        id, occurred_at, actor_id, actor_role_at_time, actor_label,
        category, action, target_type, target_id, summary, ip_hash, user_agent
      FROM activity_events
      ORDER BY occurred_at DESC, id DESC
      LIMIT 50;
    `;
    const keysetPlan = explainKeyset.map(r => r["QUERY PLAN"]).join("\n");
    const keysetExecMatch = keysetPlan.match(/Execution Time: ([\d.]+) ms/);
    const keysetExecTime = keysetExecMatch ? parseFloat(keysetExecMatch[1]) : 0;

    const keysetStart = performance.now();
    const page1Rows = await sql`
      SELECT
        id, occurred_at, actor_id, actor_role_at_time, actor_label,
        category, action, target_type, target_id, summary, ip_hash, user_agent
      FROM activity_events
      ORDER BY occurred_at DESC, id DESC
      LIMIT 50;
    `;
    const keysetDuration = performance.now() - keysetStart;

    console.log(`Keyset Page 1 returned: ${page1Rows.length} rows`);
    console.log(`PostgreSQL Engine Execution Time: ${keysetExecTime.toFixed(3)} ms`);
    console.log(`Client Network Roundtrip Time: ${keysetDuration.toFixed(2)} ms`);
    if (keysetDuration <= 500) {
      console.log(`✅ PASSED: Keyset query completed in ${keysetDuration.toFixed(2)} ms (< 500ms limit)\n`);
    } else {
      console.warn(`⚠️ Client roundtrip took ${keysetDuration.toFixed(2)} ms (Engine was ${keysetExecTime.toFixed(3)} ms)\n`);
    }

    // ==========================================
    // BENCHMARK 2: Signals & Aggregations
    // ==========================================
    console.log("--- TEST 2: SIGNALS & CATEGORY COUNTS ---");

    const explainSignals = await sql`
      EXPLAIN (ANALYZE, TIMING)
      SELECT
        COUNT(*)::int as total_today,
        COUNT(*) FILTER (WHERE action = 'signin.failed')::int as failed_signins_today,
        COUNT(*) FILTER (WHERE action IN ('record.deleted', 'record.permanently_deleted'))::int as records_deleted_today,
        COUNT(*) FILTER (
          WHERE EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'Africa/Lagos') >= 22
             OR EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'Africa/Lagos') < 6
        )::int as after_hours_today
      FROM activity_events
      WHERE occurred_at >= (now() - interval '24 hours');
    `;
    const signalsPlan = explainSignals.map(r => r["QUERY PLAN"]).join("\n");
    const signalsExecMatch = signalsPlan.match(/Execution Time: ([\d.]+) ms/);
    const signalsExecTime = signalsExecMatch ? parseFloat(signalsExecMatch[1]) : 0;

    const signalsStart = performance.now();
    const [signals] = await sql`
      SELECT
        COUNT(*)::int as total_today,
        COUNT(*) FILTER (WHERE action = 'signin.failed')::int as failed_signins_today,
        COUNT(*) FILTER (WHERE action IN ('record.deleted', 'record.permanently_deleted'))::int as records_deleted_today,
        COUNT(*) FILTER (
          WHERE EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'Africa/Lagos') >= 22
             OR EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'Africa/Lagos') < 6
        )::int as after_hours_today
      FROM activity_events
      WHERE occurred_at >= (now() - interval '24 hours');
    `;
    const signalsDuration = performance.now() - signalsStart;

    console.log("Signals result:", signals);
    console.log(`PostgreSQL Engine Execution Time: ${signalsExecTime.toFixed(3)} ms`);
    console.log(`Client Network Roundtrip Time: ${signalsDuration.toFixed(2)} ms`);
    if (signalsDuration <= 500) {
      console.log(`✅ PASSED: Signals query completed in ${signalsDuration.toFixed(2)} ms (< 500ms limit)\n`);
    } else {
      console.warn(`⚠️ Client roundtrip took ${signalsDuration.toFixed(2)} ms (Engine was ${signalsExecTime.toFixed(3)} ms)\n`);
    }

    // ==========================================
    // BENCHMARK 3: Filtered Queries
    // ==========================================
    console.log("--- TEST 3: FILTERED QUERIES ---");

    // 3A. Filter by category ('records')
    const catStart = performance.now();
    const catRows = await sql`
      SELECT
        id, occurred_at, actor_label, category, action, summary, ip_hash, user_agent
      FROM activity_events
      WHERE category = 'records'
      ORDER BY occurred_at DESC, id DESC
      LIMIT 50;
    `;
    const catDuration = performance.now() - catStart;
    console.log(`Filter by category ('records') (${catRows.length} rows): ${catDuration.toFixed(2)} ms`);

    // 3B. Filter by text search ('prescription')
    const searchStart = performance.now();
    const searchRows = await sql`
      SELECT
        id, occurred_at, actor_label, category, action, summary, ip_hash, user_agent
      FROM activity_events
      WHERE summary ILIKE '%prescription%'
      ORDER BY occurred_at DESC, id DESC
      LIMIT 50;
    `;
    const searchDuration = performance.now() - searchStart;
    console.log(`Filter by text search ('prescription') (${searchRows.length} rows): ${searchDuration.toFixed(2)} ms`);

    // 3C. Filter by actor + category + date range
    const complexStart = performance.now();
    const complexRows = await sql`
      SELECT
        id, occurred_at, actor_label, category, action, summary, ip_hash, user_agent
      FROM activity_events
      WHERE actor_label = 'Dr. Adebayo Ogunlesi'
        AND category = 'records'
        AND occurred_at >= (now() - interval '30 days')
      ORDER BY occurred_at DESC, id DESC
      LIMIT 50;
    `;
    const complexDuration = performance.now() - complexStart;
    console.log(`Complex filter (actor + category + date) (${complexRows.length} rows): ${complexDuration.toFixed(2)} ms`);

    const maxFiltered = Math.max(catDuration, searchDuration, complexDuration);
    if (maxFiltered <= 500) {
      console.log(`\n✅ PASSED: All filtered queries took < ${maxFiltered.toFixed(2)} ms (< 500ms limit)\n`);
    } else {
      console.warn(`\n⚠️ Maximum filtered client roundtrip took ${maxFiltered.toFixed(2)} ms\n`);
    }

    console.log("=== BENCHMARK COMPLETE ===");

  } finally {
    await sql.end();
  }
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
