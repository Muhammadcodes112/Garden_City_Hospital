import "dotenv/config";
import postgres from "postgres";

async function testTrigger() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });

  try {
    console.log("1. Testing INSERT into activity_events...");
    const [row] = await sql`
      INSERT INTO activity_events (
        category,
        action,
        summary,
        actor_label,
        metadata
      ) VALUES (
        'auth',
        'test.trigger_check',
        'Temporary test row for append-only trigger validation',
        'System Test',
        '{"test": true}'::jsonb
      )
      RETURNING id, occurred_at;
    `;
    console.log("✅ Successfully inserted test row with ID:", row.id);

    console.log("\n2. Testing UPDATE (must fail)...");
    try {
      await sql`
        UPDATE activity_events
        SET summary = 'Attempted update'
        WHERE id = ${row.id};
      `;
      console.error("❌ FAILED: UPDATE succeeded when it should have raised an exception!");
    } catch (err: any) {
      console.log("✅ UPDATE correctly failed with error:");
      console.log("   Message:", err.message);
      console.log("   Code:", err.code);
    }

    console.log("\n3. Testing DELETE without retention flag (must fail)...");
    try {
      await sql`
        DELETE FROM activity_events
        WHERE id = ${row.id};
      `;
      console.error("❌ FAILED: DELETE succeeded when it should have raised an exception!");
    } catch (err: any) {
      console.log("✅ DELETE correctly failed with error:");
      console.log("   Message:", err.message);
      console.log("   Code:", err.code);
    }

    console.log("\n4. Testing DELETE with retention bypass flag in transaction (cleanup)...");
    await sql.begin(async (tx) => {
      await tx`SET LOCAL app.allow_retention_delete = 'true'`;
      const deleted = await tx`
        DELETE FROM activity_events
        WHERE id = ${row.id}
        RETURNING id;
      `;
      console.log("✅ Retention bypass DELETE succeeded, cleaned up row:", deleted[0]?.id);
    });

  } finally {
    await sql.end();
  }
}

testTrigger().catch((err) => {
  console.error("Trigger test failed:", err);
  process.exit(1);
});
