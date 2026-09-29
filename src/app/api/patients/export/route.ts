import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { patients, formRecords } from "@/db/schema";
import { gte, lte, and, eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const exportType = searchParams.get("type") || "all"; // all, patients, lab, prescription, medical_report

  try {
    let conditions = [];

    if (startDate) {
      conditions.push(gte(patients.createdAt, new Date(startDate)));
    }
    if (endDate) {
      // Include the entire end date till 23:59:59
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(patients.createdAt, end));
    }

    const patientRows = await db
      .select()
      .from(patients)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(patients.createdAt));

    // Build CSV Headers & Rows
    const csvHeaders = [
      "Hospital File No",
      "Surname",
      "First Names",
      "Age",
      "Sex",
      "Marital Status",
      "Phone",
      "Address",
      "Next of Kin Name",
      "Next of Kin Relationship",
      "Next of Kin Phone",
      "Blood Group",
      "Rhesus",
      "Genotype",
      "Allergies",
      "Status",
      "Doctor",
      "Date Registered",
    ];

    const csvRows = patientRows.map((p) => [
      escapeCsv(p.hospitalNumber),
      escapeCsv(p.surname),
      escapeCsv(p.firstNames),
      escapeCsv(p.age || ""),
      escapeCsv(p.sex || ""),
      escapeCsv(p.maritalStatus || ""),
      escapeCsv(p.phone || ""),
      escapeCsv(p.address || ""),
      escapeCsv(p.nextOfKinName || ""),
      escapeCsv(p.nextOfKinRelationship || ""),
      escapeCsv(p.nextOfKinPhone || ""),
      escapeCsv(p.bloodGroup || ""),
      escapeCsv(p.rhesus || ""),
      escapeCsv(p.genotype || ""),
      escapeCsv(p.allergies || ""),
      escapeCsv(p.status || ""),
      escapeCsv(p.doctor || ""),
      escapeCsv(new Date(p.createdAt).toISOString().split("T")[0]),
    ]);

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.join(",")),
    ].join("\n");

    const dateSuffix = `${startDate || "all"}_to_${endDate || "present"}`;
    const filename = `GardenCity_Patients_Export_${dateSuffix}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

function escapeCsv(str: string): string {
  if (!str) return '""';
  const cleaned = str.replace(/"/g, '""');
  return `"${cleaned}"`;
}
