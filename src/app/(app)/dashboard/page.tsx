import { requireAdmin } from "@/lib/session";
import { getDashboardStats, listRecentFormRecords } from "@/lib/dashboard";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { formatDate } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireAdmin();
  const userName = session.user.name ?? session.user.email;

  const [stats, recent] = await Promise.all([getDashboardStats(), listRecentFormRecords(100)]);

  const todayLabel = formatDate(new Date());

  return (
    <DashboardView
      userName={userName}
      todayLabel={todayLabel}
      stats={stats}
      recentForms={recent.map((row) => ({
        ...row,
        updatedAt: row.updatedAt.toISOString(),
      }))}
    />
  );
}
