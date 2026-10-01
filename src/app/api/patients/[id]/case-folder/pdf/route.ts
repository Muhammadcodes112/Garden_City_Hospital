import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { caseFolderPdfHtml, caseFolderPdfFilename } from "@/lib/pdf-templates/case-folder";
import { renderPdf } from "@/lib/pdf";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const download = url.searchParams.get("download") === "1";
  const htmlOnly = url.searchParams.get("html") === "1";

  const rows = await db
    .select()
    .from(patients)
    .where(eq(patients.id, id))
    .limit(1);

  const p = rows[0];
  if (!p) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const caseFileData = (p.caseFileData as any) || {};

  const html = caseFolderPdfHtml({
    patient: {
      surname: p.surname,
      firstNames: p.firstNames,
      hospitalNumber: p.hospitalNumber,
      age: p.age ?? "",
      sex: p.sex ?? "",
      dob: p.dob ?? "",
      maritalStatus: p.maritalStatus ?? "",
      phone: p.phone ?? "",
      address: p.address ?? "",
      nextOfKinName: p.nextOfKinName ?? "",
      nextOfKinRelationship: p.nextOfKinRelationship ?? "",
      nextOfKinPhone: p.nextOfKinPhone ?? "",
      nextOfKinAddress: p.nextOfKinAddress ?? "",
      xRayNumber: p.xRayNumber ?? "",
      placeOfOrigin: p.placeOfOrigin ?? "",
      tribe: p.tribe ?? "",
      occupation: p.occupation ?? "",
      religion: p.religion ?? "",
      bloodGroup: p.bloodGroup ?? "",
      rhesus: p.rhesus ?? "",
      genotype: p.genotype ?? "",
      allergies: p.allergies ?? "",
      status: p.status ?? "",
      doctor: p.doctor ?? "",
      caseFolderPreparedBy: caseFileData.caseFolderPreparedBy ?? "Medical Records Officer",
      hasOperations: Boolean(caseFileData.hasOperations),
      hospitalHistory: caseFileData.hospitalHistory ?? [],
      diagnoses: caseFileData.diagnoses ?? [],
      operations: caseFileData.operations ?? [],
      operationConsents: caseFileData.operationConsents ?? [],
    },
  });

  if (htmlOnly) {
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const filename = caseFolderPdfFilename(p);

  try {
    const pdfBuffer = await renderPdf(html);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Failed to render Case Folder PDF, returning HTML fallback:", err);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
