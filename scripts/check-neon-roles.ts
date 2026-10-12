import "dotenv/config";
import postgres from "postgres";

async function checkRolesAndGrants() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });

  try {
    const [currentUser] = await sql`SELECT current_user, session_user;`;
    console.log("Current user:", currentUser);

    const [tableInfo] = await sql`
      SELECT tableowner
      FROM pg_tables
      WHERE tablename = 'activity_events';
    `;
    console.log("Table owner of activity_events:", tableInfo);

    const roles = await sql`
      SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin
      FROM pg_roles
      WHERE rolname IN ('neondb_owner', 'activity_retention', 'authenticated', 'anonymous')
         OR rolname = current_user;
    `;
    console.log("Relevant roles:", roles);

    // Let's test if REVOKE UPDATE, DELETE on activity_events FROM current_user can be executed
    try {
      await sql.unsafe(`REVOKE UPDATE, DELETE ON "activity_events" FROM "${currentUser.current_user}";`);
      console.log("REVOKE UPDATE, DELETE executed without syntax error.");
    } catch (e: any) {
      console.log("REVOKE failed:", e.message);
    }

  } finally {
    await sql.end();
  }
}

checkRolesAndGrants().catch(console.error);
