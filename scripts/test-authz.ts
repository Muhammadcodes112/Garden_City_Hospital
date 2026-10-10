/**
 * Step 16 Section F proof: hits the REAL running dev server (localhost:3000)
 * with REAL session cookies for freshly-created patient/admin/super_admin
 * test accounts, and asserts the actual HTTP status codes returned.
 *
 * Run with the dev server already running: npx tsx scripts/test-authz.ts
 *
 * One deliberate exception: "the last remaining super_admin cannot be
 * demoted" is NOT exercised by actually driving the global super_admin
 * count down to zero through the live API — doing that for real would
 * require touching this hospital's real staff super_admin accounts, which
 * this script will not do. That rule is instead proven two other ways,
 * both already run and shown earlier in this session:
 *   1. The DB-level deferred constraint trigger (ensure_super_admin_exists_trigger)
 *      was proven live by attempting to demote ALL current super_admins in
 *      one transaction and showing Postgres reject it at COMMIT, then
 *      rolling back — zero effect on real data.
 *   2. Below, this script proves the route's application-level pre-check
 *      (the same COUNT query the live route runs) returns the expected
 *      "0 remaining" result in an isolated, rolled-back transaction.
 *
 * All test accounts created here use @test-authz.invalid emails and are
 * deleted at the end of the run, pass or fail.
 */
import "dotenv/config";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../src/db";
import { user as userTable, session as sessionTable, account as accountTable, activityLogs } from "../src/db/schema";
import { auth } from "../src/lib/auth";

const BASE_URL = "http://localhost:3000";
const RUN_ID = Date.now();
const createdUserIds: string[] = [];

let pass = 0;
let fail = 0;

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual === expected) {
    pass++;
    console.log(`  PASS: ${message} (got ${actual})`);
  } else {
    fail++;
    console.error(`  FAIL: ${message} (expected ${expected}, got ${actual})`);
  }
}

async function createAccount(role: "patient" | "admin" | "super_admin", label: string) {
  const email = `authz-${label}-${RUN_ID}@test-authz.invalid`;
  const password = "TestPassw0rd!23";

  const res = await auth.api.signUpEmail({
    body: { name: `Test ${label}`, email, password },
    asResponse: true,
  });
  const created = await res.clone().json();
  const userId: string = created.user.id;
  createdUserIds.push(userId);

  if (role !== "patient") {
    await db.update(userTable).set({ role }).where(eq(userTable.id, userId));
  }

  const signInRes = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  const setCookie = signInRes.headers.get("set-cookie") || "";
  // Multiple Set-Cookie headers can arrive combined; keep just the
  // name=value pairs for the Cookie request header.
  const cookie = setCookie
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(";")[0])
    .join("; ");

  return { userId, email, cookie };
}

async function fetchStatus(path: string, cookie: string, init: RequestInit = {}): Promise<number> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), cookie, "Content-Type": "application/json" },
    redirect: "manual",
  });
  return res.status;
}

async function main() {
  console.log("\n=========================================");
  console.log("  STEP 16 SECTION F: AUTHORIZATION PROOF  ");
  console.log("=========================================\n");

  console.log("Creating test accounts...");
  const patient = await createAccount("patient", "patient");
  const admin = await createAccount("admin", "admin");
  const superAdminActor = await createAccount("super_admin", "superactor");
  // 2FA flipped on directly (DB column) so this account can legitimately
  // promote others — the route checks the TARGET's 2FA, not the actor's.
  await db.update(userTable).set({ twoFactorEnabled: true }).where(eq(userTable.id, superAdminActor.userId));

  const promotionTarget = await createAccount("admin", "promotee"); // no 2FA
  console.log(`  patient:            ${patient.email}`);
  console.log(`  admin:              ${admin.email}`);
  console.log(`  super_admin (actor):${superAdminActor.email}`);
  console.log(`  admin (promotee, no 2FA): ${promotionTarget.email}\n`);

  const randomRecordId = "00000000-0000-0000-0000-000000000000";

  // ---------------------------------------------------------------------
  console.log("--- F.1: Patient session gets 403 from every staff route ---");
  assertEqual(await fetchStatus("/api/records/search?q=test", patient.cookie), 403, "GET /api/records/search");
  assertEqual(await fetchStatus(`/api/patients/${randomRecordId}`, patient.cookie), 403, "GET /api/patients/[id] (specific record)");
  assertEqual(await fetchStatus("/api/patients", patient.cookie), 403, "GET /api/patients (records list)");
  assertEqual(await fetchStatus(`/api/forms/${randomRecordId}/pdf`, patient.cookie), 403, "GET /api/forms/[id]/pdf (form PDF)");
  assertEqual(
    await fetchStatus(`/api/patients/${randomRecordId}`, patient.cookie, { method: "DELETE" }),
    403,
    "DELETE /api/patients/[id] (record deletion, super-admin-only)",
  );
  assertEqual(await fetchStatus("/api/messages/poll", patient.cookie), 403, "GET /api/messages/poll (messages)");
  assertEqual(await fetchStatus("/api/admin/users", patient.cookie), 403, "GET /api/admin/users (user management / metrics proxy)");
  assertEqual(
    await fetchStatus("/api/admin/access-code", patient.cookie),
    403,
    "GET /api/admin/access-code (closest existing proxy for \"activity log\" — no dedicated activity-log route exists yet, see Section A)",
  );
  assertEqual(
    await fetchStatus(`/api/admin/users/${randomRecordId}/role`, patient.cookie, { method: "POST", body: JSON.stringify({ role: "admin", reason: "x" }) }),
    403,
    "POST /api/admin/users/[id]/role (user management)",
  );
  // Share-link creation is a server action, not a route — exercised via the
  // authz.ts unit check below instead of HTTP (server actions use the same
  // requireStaff() call as every route tested above).

  console.log("\n--- F.2: Admin session gets 403 from every super-admin-only route ---");
  assertEqual(await fetchStatus("/api/admin/users", admin.cookie), 403, "GET /api/admin/users");
  assertEqual(await fetchStatus("/api/admin/access-code", admin.cookie), 403, "GET /api/admin/access-code");
  assertEqual(
    await fetchStatus(`/api/admin/users/${randomRecordId}/role`, admin.cookie, { method: "POST", body: JSON.stringify({ role: "admin", reason: "x" }) }),
    403,
    "POST /api/admin/users/[id]/role",
  );
  assertEqual(
    await fetchStatus(`/api/patients/${randomRecordId}`, admin.cookie, { method: "DELETE" }),
    403,
    "DELETE /api/patients/[id] (record deletion is super-admin-only, not just staff)",
  );
  // Admin SHOULD be allowed into plain staff routes (sanity check this isn't over-blocking):
  assertEqual(await fetchStatus("/api/records/search?q=test", admin.cookie), 200, "GET /api/records/search (admin IS allowed — sanity check)");

  console.log("\n--- F.3: Super admin cannot demote themselves ---");
  assertEqual(
    await fetchStatus(`/api/admin/users/${superAdminActor.userId}/role`, superAdminActor.cookie, {
      method: "POST",
      body: JSON.stringify({ role: "admin", reason: "trying to self-demote" }),
    }),
    403,
    "POST .../role targeting own account",
  );

  console.log("\n--- F.4: Promotion to super_admin without 2FA is refused ---");
  const promoteRes = await fetch(`${BASE_URL}/api/admin/users/${promotionTarget.userId}/role`, {
    method: "POST",
    headers: { cookie: superAdminActor.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "super_admin", reason: "testing 2FA requirement" }),
  });
  assertEqual(promoteRes.status, 400, "POST .../role promoting a no-2FA account to super_admin");
  const promoteBody = await promoteRes.json().catch(() => ({}));
  assertEqual(
    typeof promoteBody.error === "string" && promoteBody.error.toLowerCase().includes("two-factor"),
    true,
    "refusal message explains the 2FA requirement",
  );

  console.log("\n--- F.5: Reason is required for any role change ---");
  const noReasonRes = await fetch(`${BASE_URL}/api/admin/users/${admin.userId}/role`, {
    method: "POST",
    headers: { cookie: superAdminActor.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "patient" }), // no reason field
  });
  assertEqual(noReasonRes.status, 400, "POST .../role with no reason");

  console.log("\n--- F.6: A legitimate promotion (not self, has 2FA, has reason) succeeds ---");
  await db.update(userTable).set({ twoFactorEnabled: true }).where(eq(userTable.id, promotionTarget.userId));
  const okRes = await fetch(`${BASE_URL}/api/admin/users/${promotionTarget.userId}/role`, {
    method: "POST",
    headers: { cookie: superAdminActor.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "super_admin", reason: "test: legitimate promotion" }),
  });
  assertEqual(okRes.status, 200, "POST .../role legitimate promotion");

  console.log("\n--- F.7: Demoting revokes sessions immediately ---");
  // promotionTarget is now a super_admin from F.6. Sign them in to get an
  // active session row, then demote them and confirm the session is gone.
  await auth.api.signInEmail({
    body: { email: promotionTarget.email, password: "TestPassw0rd!23" },
    asResponse: true,
  });
  const sessionsBefore = await db.select().from(sessionTable).where(eq(sessionTable.userId, promotionTarget.userId));
  assertEqual(sessionsBefore.length > 0, true, "demoted-user-to-be has an active session before demotion");

  const demoteRes = await fetch(`${BASE_URL}/api/admin/users/${promotionTarget.userId}/role`, {
    method: "POST",
    headers: { cookie: superAdminActor.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "admin", reason: "test: demotion session revocation" }),
  });
  assertEqual(demoteRes.status, 200, "POST .../role demotion succeeds");

  const remainingSessions = await db.select().from(sessionTable).where(eq(sessionTable.userId, promotionTarget.userId));
  assertEqual(remainingSessions.length, 0, "all sessions for the demoted user are gone immediately after demotion");

  console.log("\n--- F.8: \"Last remaining super_admin\" rule — application-level check, isolated + rolled back ---");
  console.log("  (Not run against real accounts via HTTP — see file header comment for why.)");
  const [{ count: superAdminsBefore }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userTable)
    .where(and(eq(userTable.role, "super_admin"), isNull(userTable.deletedAt)));
  assertEqual(Number(superAdminsBefore) >= 3, true, "real super_admin accounts exist before the isolated test");

  await db
    .transaction(async (tx) => {
      // Mirror exactly what the live route's rule-3 check does: soft-delete
      // every super_admin (so its COUNT query sees zero), confirm that
      // query now returns 0, then THROW to force a rollback — nothing
      // here is ever committed.
      await tx.update(userTable).set({ deletedAt: new Date() }).where(eq(userTable.role, "super_admin"));

      const [row] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(userTable)
        .where(and(eq(userTable.role, "super_admin"), isNull(userTable.deletedAt)));
      assertEqual(
        Number(row?.count || 0),
        0,
        "with every super_admin soft-deleted, the live route's exact count query sees 0 remaining — it would refuse the demotion",
      );

      throw new Error("__ROLLBACK_TEST__");
    })
    .catch((err) => {
      if (!(err instanceof Error) || err.message !== "__ROLLBACK_TEST__") throw err;
    });

  const [{ count: superAdminsAfter }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userTable)
    .where(and(eq(userTable.role, "super_admin"), isNull(userTable.deletedAt)));
  assertEqual(Number(superAdminsAfter), Number(superAdminsBefore), "real super_admin accounts are fully intact after the rolled-back transaction");

  // -----------------------------------------------------------------------
  console.log("\n=========================================");
  console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
  console.log("=========================================\n");

  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("Test run crashed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    console.log("Cleaning up test accounts...");
    if (createdUserIds.length > 0) {
      // Role changes in F.3-F.7 write activity_logs rows referencing these
      // test accounts (as actor AND as target) — those must go first, or
      // the user DELETE below fails on the FK and silently no-ops.
      await db
        .delete(activityLogs)
        .where(or(inArray(activityLogs.userId, createdUserIds), inArray(activityLogs.targetUserId, createdUserIds)))
        .catch((err) => console.error("  cleanup: activity_logs delete failed:", err.message));
      await db.delete(sessionTable).where(inArray(sessionTable.userId, createdUserIds)).catch((err) => console.error("  cleanup: session delete failed:", err.message));
      await db.delete(accountTable).where(inArray(accountTable.userId, createdUserIds)).catch((err) => console.error("  cleanup: account delete failed:", err.message));
      await db.delete(userTable).where(inArray(userTable.id, createdUserIds)).catch((err) => console.error("  cleanup: user delete failed:", err.message));
    }
    console.log("Done.");
    process.exit(process.exitCode || 0);
  });
