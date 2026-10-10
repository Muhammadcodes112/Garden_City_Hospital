import { redirect } from "next/navigation";
import { createPrescriptionDraftRecord } from "@/lib/actions/prescription-form";

export const dynamic = "force-dynamic";

export default async function NewPrescriptionPage() {
  const { recordId } = await createPrescriptionDraftRecord();
  redirect(`/prescription/${recordId}`);
}
