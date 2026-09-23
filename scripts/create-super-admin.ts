import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { user } from "../src/db/schema";
import { auth } from "../src/lib/auth";

async function main() {
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || "funguyallen@gmail.com").trim().toLowerCase();
  console.log(`\n========================================`);
  console.log(`  GARDEN CITY HOSPITAL SUPER ADMIN SCRIPT `);
  console.log(`========================================`);
  console.log(`Target Super Admin Email: ${superAdminEmail}`);

  // Check if user exists
  const existingUsers = await db
    .select()
    .from(user)
    .where(eq(user.email, superAdminEmail))
    .limit(1);

  const existingUser = existingUsers[0];

  if (existingUser) {
    console.log(`User found with ID: ${existingUser.id}`);
    if (existingUser.role === "super_admin") {
      console.log(`User ${superAdminEmail} is ALREADY a super_admin. No changes required.`);
      process.exit(0);
    }

    // Demote any old super admin first to obey single super_admin rule
    await db.update(user).set({ role: "admin" }).where(eq(user.role, "super_admin"));

    // Promote to super_admin
    await db.update(user).set({ role: "super_admin" }).where(eq(user.id, existingUser.id));

    console.log(`✓ SUCCESS: Promoted ${superAdminEmail} to 'super_admin'!`);
  } else {
    // Read password from CLI args e.g. --password=MySecretPassword123
    const passArg = process.argv.find((a) => a.startsWith("--password="));
    const password = passArg ? passArg.split("=")[1] : "SuperAdmin@2026";

    if (!password || password.length < 8) {
      console.error("Error: Password must be at least 8 characters");
      process.exit(1);
    }

    console.log(`Creating new account for ${superAdminEmail}...`);

    // Demote any old super_admin first
    await db.update(user).set({ role: "admin" }).where(eq(user.role, "super_admin"));

    const created = await auth.api.signUpEmail({
      body: {
        name: "Super Admin",
        email: superAdminEmail,
        password: password,
      },
    });

    if (created && created.user) {
      await db.update(user).set({ role: "super_admin" }).where(eq(user.id, created.user.id));
      console.log(`✓ SUCCESS: Created new account for ${superAdminEmail} and granted 'super_admin' role!`);
      console.log(`Initial Password: ${password}`);
    } else {
      console.error("Failed to create account.");
      process.exit(1);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
