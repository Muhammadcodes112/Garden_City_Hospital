import { notFound } from "next/navigation";
import { getMedicalReportFormRecord } from "@/lib/actions/medical-report-form";
import { MedicalReportEditor } from "@/components/medical-report/medical-report-editor";

export const dynamic = "force-dynamic";

export default async function EditMedicalReportPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const initial = await getMedicalReportFormRecord(id);

  if (!initial) {
    notFound();
  }

  return <MedicalReportEditor initial={initial} />;
}
