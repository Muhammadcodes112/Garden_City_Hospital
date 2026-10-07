import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

/** Unauthenticated on purpose — uptime monitors need to hit this without credentials. Never returns patient data or connection details. */
export async function GET() {
  let database: "connected" | "disconnected" = "disconnected";
  try {
    await db.execute(sql`SELECT 1`);
    database = "connected";
  } catch {
    database = "disconnected";
  }

  const status = database === "connected" ? "ok" : "error";
  return NextResponse.json(
    {
      status,
      database,
      version: packageJson.version,
      timestamp: new Date().toISOString(),
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
