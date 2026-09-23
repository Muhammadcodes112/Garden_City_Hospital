import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/session";
import { searchFormRecords } from "@/lib/search";

export async function GET(request: Request) {
  const session = await requireAdminApi();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  const results = await searchFormRecords({
    query: q,
    limit: 20,
  });

  return NextResponse.json(results);
}
