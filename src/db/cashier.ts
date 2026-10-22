import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Connection for everything in the cashier area, logged in as the
 * restricted `cashier_app` role (scripts/setup-cashier-role.ts). That role
 * can read only id/name/hospital number/age/sex/phone from `patients` and
 * nothing clinical, so a query that strays into clinical data fails in
 * Postgres rather than leaking it. Always select explicit columns from
 * `patients` and `user` through this client.
 *
 * In production a missing CASHIER_DATABASE_URL is an error — falling back to
 * the owner connection would silently drop the enforcement. Locally it falls
 * back (with a warning) so the cashier screens still run in development.
 */

const globalForCashierDb = globalThis as unknown as { cashierConn: postgres.Sql | undefined };

function connectionString(): string {
  const url = process.env.CASHIER_DATABASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("CASHIER_DATABASE_URL is not set; run scripts/setup-cashier-role.ts and add it to the environment");
  }
  console.warn("CASHIER_DATABASE_URL not set; cashier queries are using DATABASE_URL (development only, NOT restricted)");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  return process.env.DATABASE_URL;
}

/** False in production until CASHIER_DATABASE_URL is set (cashier pages then show a setup notice). */
export function isCashierDbConfigured(): boolean {
  return Boolean(process.env.CASHIER_DATABASE_URL) || process.env.NODE_ENV !== "production";
}

let cached: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getCashierDb() {
  if (cached) return cached;
  const client =
    globalForCashierDb.cashierConn ??
    postgres(connectionString(), { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10 });
  if (process.env.NODE_ENV !== "production") globalForCashierDb.cashierConn = client;
  cached = drizzle(client, { schema });
  return cached;
}
