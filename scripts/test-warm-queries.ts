import "dotenv/config";
import postgres from "postgres";

async function testWarmQueries() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: true });
  try {
    // Warm up connection
    await sql`SELECT 1`;

    console.log("Measuring database-level execution time and client roundtrip time over 5 runs:");

    for (let i = 1; i <= 5; i++) {
      const t0 = performance.now();
      const rows = await sql`
        SELECT id, occurred_at, actor_label, category, action, summary
        FROM activity_events
        ORDER BY occurred_at DESC, id DESC
        LIMIT 50;
      `;
      const dur = performance.now() - t0;
      console.log(`Run ${i} - Keyset Page 1 (50 rows): ${dur.toFixed(2)}ms`);
    }

    for (let i = 1; i <= 5; i++) {
      const t0 = performance.now();
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
      const dur = performance.now() - t0;
      console.log(`Run ${i} - Signals query: ${dur.toFixed(2)}ms`);
    }

    for (let i = 1; i <= 5; i++) {
      const t0 = performance.now();
      const rows = await sql`
        SELECT id, occurred_at, actor_label, category, action, summary
        FROM activity_events
        WHERE category = 'records'
        ORDER BY occurred_at DESC, id DESC
        LIMIT 50;
      `;
      const dur = performance.now() - t0;
      console.log(`Run ${i} - Filtered query (records): ${dur.toFixed(2)}ms`);
    }

  } finally {
    await sql.end();
  }
}

testWarmQueries().catch(console.error);
