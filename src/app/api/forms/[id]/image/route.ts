import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { formRecords, patients } from "@/db/schema";
import { requireAdminApi } from "@/lib/session";
import { labRequestDataSchema } from "@/lib/validators/lab-request";
import { labRequestPdfHtml } from "@/lib/pdf-templates/lab-request";
import { prescriptionDataSchema } from "@/lib/validators/prescription";
import { prescriptionPdfHtml } from "@/lib/pdf-templates/prescription";
import { medicalReportDataSchema } from "@/lib/validators/medical-report";
import { medicalReportPdfHtml } from "@/lib/pdf-templates/medical-report";
import { renderFormPageImage } from "@/lib/pdf-page-renderer";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminApi();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const pageStr = url.searchParams.get("page") ?? "0";
  const resParam = url.searchParams.get("res") === "low" ? "low" : "high";
  const pageIndex = Math.max(0, parseInt(pageStr, 10) || 0);

  const rows = await db
    .select({
      type: formRecords.type,
      status: formRecords.status,
      data: formRecords.data,
      updatedAt: formRecords.updatedAt,
      surname: patients.surname,
      firstNames: patients.firstNames,
      age: patients.age,
      sex: patients.sex,
      address: patients.address,
      hospitalNumber: patients.hospitalNumber,
    })
    .from(formRecords)
    .innerJoin(patients, eq(formRecords.patientId, patients.id))
    .where(eq(formRecords.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patientObj = {
    surname: row.surname,
    firstNames: row.firstNames,
    age: row.age ?? "",
    sex: row.sex ?? "",
    address: row.address ?? "",
    hospitalNumber: row.hospitalNumber ?? "",
  };

  let html = "";

  if (row.type === "lab") {
    const data = labRequestDataSchema.parse(row.data);
    html = labRequestPdfHtml({
      patient: patientObj,
      data,
      isDraft: row.status === "draft",
    });
  } else if (row.type === "prescription") {
    const data = prescriptionDataSchema.parse(row.data);
    html = prescriptionPdfHtml({
      patient: patientObj,
      data,
      isDraft: row.status === "draft",
    });
  } else if (row.type === "medical_report") {
    const data = medicalReportDataSchema.parse(row.data);
    html = medicalReportPdfHtml({
      patient: patientObj,
      data,
      isDraft: row.status === "draft",
    });
  } else {
    return NextResponse.json({ error: "Form type not supported" }, { status: 400 });
  }

  try {
    const { buffer, pageCount } = await renderFormPageImage({
      html,
      recordId: id,
      updatedAt: row.updatedAt,
      pageIndex,
      resolution: resParam,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        "X-Page-Count": `${pageCount}`,
      },
    });
  } catch (err) {
    console.error("Failed to render page image:", err);
    return NextResponse.json({ error: "Failed to render image" }, { status: 500 });
  }
}
