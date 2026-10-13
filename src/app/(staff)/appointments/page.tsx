import { requireStaff } from "@/lib/authz";
import { StaffAppointmentsGrid } from "@/components/appointments/staff-appointments-grid";

export const metadata = {
  title: "Appointments Day Grid | Garden City Specialist Hospital",
};

export const dynamic = "force-dynamic";

export default async function StaffAppointmentsPage() {
  await requireStaff();

  return <StaffAppointmentsGrid />;
}
