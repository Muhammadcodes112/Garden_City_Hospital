import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { searchFormRecords } from "@/lib/search";

export async function GET(request: Request) {
  const session = await requireStaff();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  const results = await searchFormRecords({
    query: q,
    limit: 20,
  });

  return NextResponse.json(results);
}
