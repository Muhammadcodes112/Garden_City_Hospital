import "dotenv/config";
import postgres from "postgres";

async function profileQueries() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  try {
    console.log("=== EXPLAIN ANALYZE BREAKDOWN ===");

    console.log("\n1. Keyset Page 1 (50 items):");
    const t0 = performance.now();
    const q1 = await sql`
      EXPLAIN ANALYZE
      SELECT id, occurred_at, actor_label, category, action, summary
      FROM activity_events
      ORDER BY occurred_at DESC, id DESC
      LIMIT 50;
    `;
    console.log(`Execution time: ${(performance.now() - t0).toFixed(2)}ms`);
    console.log(q1.map(r => r["QUERY PLAN"]).join("\n"));

    console.log("\n2. Signals Query (last 24 hours):");
    const t1 = performance.now();
    const q2 = await sql`
      EXPLAIN ANALYZE
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
    console.log(`Execution time: ${(performance.now() - t1).toFixed(2)}ms`);
    console.log(q2.map(r => r["QUERY PLAN"]).join("\n"));

    console.log("\n3. Category counts (GROUP BY category):");
    const t2 = performance.now();
    const q3 = await sql`
      EXPLAIN ANALYZE
      SELECT category, COUNT(*)::int as count
      FROM activity_events
      GROUP BY category;
    `;
    console.log(`Execution time: ${(performance.now() - t2).toFixed(2)}ms`);
    console.log(q3.map(r => r["QUERY PLAN"]).join("\n"));

  } finally {
    await sql.end();
  }
}

profileQueries().catch(console.error);
