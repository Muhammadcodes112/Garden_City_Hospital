/**
 * Creates the first (or an additional) admin account. Run with:
 *   npm run create-admin -- --name "Jane Doe" --email jane@example.com --password "..."
 *
 * This talks to Better Auth's internal API directly, not over HTTP — the
 * public /api/auth/sign-up/email route is blocked (see src/app/api/auth/[...all]/route.ts)
 * since this app has no self-service sign-up.
 */
import "dotenv/config";
import { auth } from "../src/lib/auth";

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const name = getArg("name");
  const email = getArg("email");
  const password = getArg("password");

  if (!name || !email || !password) {
    console.error(
      'Usage: npm run create-admin -- --name "Jane Doe" --email jane@example.com --password "secret"',
    );
    process.exit(1);
  }

  await auth.api.signUpEmail({ body: { name, email, password } });
  console.log(`Admin account created for ${email}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
