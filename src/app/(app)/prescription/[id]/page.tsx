import { notFound } from "next/navigation";
import { getPrescriptionFormRecord } from "@/lib/actions/prescription-form";
import { PrescriptionFormEditor } from "@/components/prescription/prescription-form-editor";

export const dynamic = "force-dynamic";

export default async function EditPrescriptionPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const initial = await getPrescriptionFormRecord(id);

  if (!initial) {
    notFound();
  }

  return <PrescriptionFormEditor initial={initial} />;
}
