import "dotenv/config";
import postgres from "postgres";

async function testOptimizedLoad() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  try {
    console.log("Adding covering index for today's signals and occurred_at...");
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS "activity_events_signals_covering_idx"
      ON "activity_events" ("occurred_at" DESC)
      INCLUDE ("action", "category");
    `);

    console.log("\nTesting combined Signals + Category Counts query:");
    const t0 = performance.now();
    const [combined] = await sql`
      WITH sig AS (
        SELECT
          COUNT(*)::int as total_today,
          COUNT(*) FILTER (WHERE action = 'signin.failed')::int as failed_signins_today,
          COUNT(*) FILTER (WHERE action IN ('record.deleted', 'record.permanently_deleted'))::int as records_deleted_today,
          COUNT(*) FILTER (
            WHERE EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'Africa/Lagos') >= 22
               OR EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'Africa/Lagos') < 6
          )::int as after_hours_today
        FROM activity_events
        WHERE occurred_at >= (now() - interval '24 hours')
      ),
      cats AS (
        SELECT jsonb_object_agg(category, cnt) as cat_counts
        FROM (
          SELECT category, count(*)::int as cnt
          FROM activity_events
          GROUP BY category
        ) c
      )
      SELECT sig.*, cats.cat_counts FROM sig, cats;
    `;
    const durCombined = performance.now() - t0;
    console.log(`Combined query duration: ${durCombined.toFixed(2)}ms`);
    console.log("Result:", combined);

    console.log("\nTesting Keyset Page 1 (50 items):");
    const t1 = performance.now();
    const rows = await sql`
      SELECT
        id, occurred_at, actor_id, actor_role_at_time, actor_label, category, action, summary, ip_hash, user_agent
      FROM activity_events
      ORDER BY occurred_at DESC, id DESC
      LIMIT 50;
    `;
    const durPage1 = performance.now() - t1;
    console.log(`Page 1 query duration: ${durPage1.toFixed(2)}ms`);

    const totalFirstLoad = durCombined + durPage1;
    console.log(`\nTOTAL FIRST LOAD TIME: ${totalFirstLoad.toFixed(2)}ms`);

  } finally {
    await sql.end();
  }
}

testOptimizedLoad().catch(console.error);
