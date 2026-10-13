import { requireUser } from "@/lib/authz";
import { PatientAppointmentsView } from "@/components/patient/patient-appointments-view";

export const metadata = {
  title: "My Appointments | Patient Portal | Garden City Specialist Hospital",
};

export const dynamic = "force-dynamic";

export default async function PatientAppointmentsPage() {
  await requireUser();

  return <PatientAppointmentsView />;
}
