import { requireAdmin } from "@/lib/session";
import { PatientsView } from "@/components/patients/patients-view";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  await requireAdmin();

  return <PatientsView />;
}
