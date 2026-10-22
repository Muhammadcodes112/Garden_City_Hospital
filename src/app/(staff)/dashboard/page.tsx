import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getRole, requireStaff } from "@/lib/authz";
import { getStaleShiftCount } from "@/lib/actions/cash-metrics";
import { STALE_SHIFT_HOURS } from "@/lib/cashier-policy";
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

  // Super Admins see cashier shifts left open too long. Never let this break the dashboard.
  let staleShifts = 0;
  if (getRole(session) === "super_admin") {
    try {
      staleShifts = await getStaleShiftCount();
    } catch (err) {
      console.error("Stale shift check failed:", err);
    }
  }

  return (
    <>
    {staleShifts > 0 ? (
      <Link
        href="/settings?tab=metrics"
        className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-500/15 dark:text-amber-300"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {staleShifts} cashier shift{staleShifts === 1 ? " has" : "s have"} been open over {STALE_SHIFT_HOURS} hours. Someone may have forgotten to close it. See Settings → Metrics.
      </Link>
    ) : null}
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
    </>
  );
}
