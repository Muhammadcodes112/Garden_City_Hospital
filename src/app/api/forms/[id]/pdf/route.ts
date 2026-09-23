import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { formRecords, patients } from "@/db/schema";
import { requireAdminApi } from "@/lib/session";
import { labRequestDataSchema } from "@/lib/validators/lab-request";
import { labRequestPdfFilename, labRequestPdfHtml } from "@/lib/pdf-templates/lab-request";
import { prescriptionDataSchema } from "@/lib/validators/prescription";
import { prescriptionPdfFilename, prescriptionPdfHtml } from "@/lib/pdf-templates/prescription";
import { medicalReportDataSchema } from "@/lib/validators/medical-report";
import { medicalReportPdfFilename, medicalReportPdfHtml } from "@/lib/pdf-templates/medical-report";
import { renderPdf } from "@/lib/pdf";

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
  const download = url.searchParams.get("download") === "1";
  const wantsHtml = url.searchParams.get("html") === "1";

  const rows = await db
    .select({
      type: formRecords.type,
      status: formRecords.status,
      data: formRecords.data,
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
  let filename = "";

  if (row.type === "lab") {
    const data = labRequestDataSchema.parse(row.data);
    html = labRequestPdfHtml({
      patient: patientObj,
      data,
      isDraft: row.status === "draft",
    });
    filename = labRequestPdfFilename(patientObj, data.formDate);
  } else if (row.type === "prescription") {
    const data = prescriptionDataSchema.parse(row.data);
    html = prescriptionPdfHtml({
      patient: patientObj,
      data,
      isDraft: row.status === "draft",
    });
    filename = prescriptionPdfFilename(patientObj, data.prescriberDate);
  } else if (row.type === "medical_report") {
    const data = medicalReportDataSchema.parse(row.data);
    html = medicalReportPdfHtml({
      patient: patientObj,
      data,
      isDraft: row.status === "draft",
    });
    filename = medicalReportPdfFilename(patientObj, data.reportDate);
  } else {
    return NextResponse.json({ error: "Form type not supported yet" }, { status: 400 });
  }

  if (wantsHtml) {
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const pdf = await renderPdf(html);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Failed to render PDF:", err);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename.replace(/\.pdf$/, ".html")}"`,
        "Cache-Control": "no-store",
      },
    });
  }
}
