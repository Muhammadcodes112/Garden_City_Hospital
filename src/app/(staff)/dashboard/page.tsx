import { requireStaff } from "@/lib/authz";
import { getDashboardStats, listRecentFormRecords, listRecentPatientFiles } from "@/lib/dashboard";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { formatDate } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireStaff();
  const userName = session.user.name ?? session.user.email;

  const [stats, recentForms, recentPatientFiles] = await Promise.all([
    getDashboardStats(),
    listRecentFormRecords(100),
    listRecentPatientFiles(100),
  ]);

  const todayLabel = formatDate(new Date());

  return (
    <DashboardView
      userName={userName}
      todayLabel={todayLabel}
      stats={stats}
      recentForms={recentForms.map((row) => ({
        ...row,
        updatedAt: row.updatedAt.toISOString(),
      }))}
      recentPatientFiles={recentPatientFiles.map((row) => ({
        ...row,
        status: row.status ?? "Outpatient",
        updatedAt: row.updatedAt.toISOString(),
      }))}
    />
  );
}
