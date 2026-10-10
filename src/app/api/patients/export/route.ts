import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { gte, lte, and, eq, desc, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const exportType = searchParams.get("type") || "all"; // all, outpatient, inpatient, discharged

  try {
    const conditions = [];

    // Exclude unpopulated draft records (records without surname & firstNames, or DRAFT- without surname)
    conditions.push(
      sql`(${patients.surname} != '' OR ${patients.firstNames} != '')`
    );
    conditions.push(
      sql`NOT (${patients.hospitalNumber} LIKE 'DRAFT-%' AND (${patients.surname} = '' OR ${patients.surname} IS NULL))`
    );

    if (startDate) {
      conditions.push(gte(patients.createdAt, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(patients.createdAt, end));
    }

    if (exportType === "outpatient") {
      conditions.push(eq(patients.status, "Outpatient"));
    } else if (exportType === "inpatient") {
      conditions.push(sql`${patients.status} LIKE 'Admitted%'`);
    } else if (exportType === "discharged") {
      conditions.push(eq(patients.status, "Discharged"));
    }

    const patientRows = await db
      .select()
      .from(patients)
      .where(and(...conditions))
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
      escapeCsv(p.createdAt ? new Date(p.createdAt).toISOString().split("T")[0] : ""),
    ]);

    // Prepend UTF-8 BOM (\uFEFF) so Excel opens and formats columns cleanly
    const csvContent =
      "\uFEFF" +
      [
        csvHeaders.join(","),
        ...csvRows.map((row) => row.join(",")),
      ].join("\r\n");

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

function escapeCsv(str: string | null | undefined): string {
  if (!str) return '""';
  const cleaned = String(str).replace(/"/g, '""');
  return `"${cleaned}"`;
}
