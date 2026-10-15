import { Suspense } from "react";
import { requireStaff } from "@/lib/authz";
import { PatientsView } from "@/components/patients/patients-view";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  await requireStaff();

  return (
    <Suspense fallback={null}>
      <PatientsView />
    </Suspense>
  );
}
