import { redirect } from "next/navigation";
import { createMedicalReportDraftRecord } from "@/lib/actions/medical-report-form";

export const dynamic = "force-dynamic";

export default async function NewMedicalReportPage() {
  const { recordId } = await createMedicalReportDraftRecord();
  redirect(`/medical-report?recordId=${recordId}`);
}
