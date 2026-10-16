import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { searchFormRecords, type SearchRecordsParams } from "@/lib/search";
import { FORM_TYPES } from "@/lib/validators/form-data";

export async function GET(request: Request) {
  await requireStaff();

  const { searchParams } = new URL(request.url);
  const get = (key: string) => searchParams.get(key) || undefined;
  // Unknown values would fail the enum comparison in Postgres; treat them as "all".
  const type = (FORM_TYPES as readonly string[]).includes(get("type") ?? "")
    ? (get("type") as SearchRecordsParams["type"])
    : undefined;
  const status = get("status") === "draft" || get("status") === "completed" ? (get("status") as "draft" | "completed") : undefined;

  const results = await searchFormRecords({
    query: get("q"),
    type,
    status,
    startDate: get("startDate"),
    endDate: get("endDate"),
    createdBy: get("createdBy"),
    page: Number(get("page")) || 1,
    limit: Number(get("limit")) || 20,
    onlyTrash: searchParams.get("onlyTrash") === "true",
  });

  return NextResponse.json(results);
}
