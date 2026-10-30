import { NextResponse } from "next/server";
import { desc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { formRecords } from "@/db/schema";
import { requireStaff } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireStaff();

    // Query recent form records to harvest past clinical notes & diagnoses
    const recent = await db
      .select({
        type: formRecords.type,
        data: formRecords.data,
      })
      .from(formRecords)
      .where(isNull(formRecords.deletedAt))
      .orderBy(desc(formRecords.createdAt))
      .limit(60);

    const harvested: string[] = [];
    const seen = new Set<string>();

    for (const row of recent) {
      const d = row.data as Record<string, unknown> | null;
      if (!d) continue;

      const candidates: string[] = [];
      if (typeof d.clinicalNotes === "string" && d.clinicalNotes.trim()) {
        candidates.push(d.clinicalNotes);
      }
      if (typeof d.provisionalDiagnosis === "string" && d.provisionalDiagnosis.trim()) {
        candidates.push(d.provisionalDiagnosis);
      }
      const sections = d.sections as Record<string, { content?: string }> | undefined;
      if (sections && typeof sections.diagnosis?.content === "string" && sections.diagnosis.content.trim()) {
        candidates.push(sections.diagnosis.content);
      }

      for (const text of candidates) {
        // Split by lines and commas
        const items = text
          .split(/[\r\n,]+/)
          .map((s) => s.replace(/^[•\-\*]\s*/, "").trim())
          .filter((s) => s.length >= 2 && s.length <= 100);

        for (const item of items) {
          const lower = item.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            harvested.push(item);
          }
        }
      }
    }

    return NextResponse.json({ history: harvested.slice(0, 100) });
  } catch (err) {
    console.error("Failed to load clinical history from DB:", err);
    return NextResponse.json({ history: [] });
  }
}
