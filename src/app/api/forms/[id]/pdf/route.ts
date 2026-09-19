import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { formRecords, patients } from "@/db/schema";
import { requireAdminApi } from "@/lib/session";
import { labRequestDataSchema } from "@/lib/validators/lab-request";
import { labRequestPdfFilename, labRequestPdfHtml } from "@/lib/pdf-templates/lab-request";
import { renderPdf } from "@/lib/pdf";

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

  const rows = await db
    .select({
      type: formRecords.type,
      status: formRecords.status,
      data: formRecords.data,
      surname: patients.surname,
      firstNames: patients.firstNames,
      age: patients.age,
      sex: patients.sex,
    })
    .from(formRecords)
    .innerJoin(patients, eq(formRecords.patientId, patients.id))
    .where(eq(formRecords.id, id))
    .limit(1);

  const row = rows[0];
  if (!row || row.type !== "lab") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patientObj = {
    surname: row.surname,
    firstNames: row.firstNames,
    age: row.age ?? "",
    sex: row.sex ?? "",
  };

  const data = labRequestDataSchema.parse(row.data);
  const html = labRequestPdfHtml({
    patient: patientObj,
    data,
    isDraft: row.status === "draft",
  });

  const pdf = await renderPdf(html);
  const filename = labRequestPdfFilename(patientObj, data.formDate);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
