import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/authz";
import {
  getActivitySignals,
  getActivityFilterMeta,
  getActivityEvents,
} from "@/lib/actions/activity-actions";
import { ActivityLogView } from "@/components/admin/activity-log-view";
import { CashMetricsView } from "@/components/admin/cash-metrics-view";
import { UsersRolesView } from "@/components/admin/users-roles-view";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings | Garden City Specialist Hospital" };
export const dynamic = "force-dynamic";

const TABS = [
  { id: "users", label: "Users & roles" },
  { id: "activity", label: "Activity log" },
  { id: "metrics", label: "Metrics" },
] as const;

type TabId = (typeof TABS)[number]["id"];

async function ActivityTab() {
  // Load initial signals, filter meta, and first 50 events in parallel
  const [signals, filterMeta, eventsRes] = await Promise.all([
    getActivitySignals(),
    getActivityFilterMeta(),
    getActivityEvents({}, null, 50),
  ]);

  return (
    <ActivityLogView
      initialSignals={signals}
      initialCounts={filterMeta.categoryCounts}
      initialActors={filterMeta.actors}
      initialEvents={eventsRes.items}
      initialHasMore={eventsRes.hasMore}
      initialNextCursor={eventsRes.nextCursor}
    />
  );
}

export default async function SettingsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  await requireSuperAdmin();
  const { tab: requested } = await props.searchParams;
  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : "users";

  return (
    <div className="space-y-4">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1 text-sm font-semibold">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/settings?tab=${t.id}`}
            className={cn(
              "whitespace-nowrap rounded-md px-4 py-2 transition-all",
              tab === t.id ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "users" ? <UsersRolesView /> : tab === "activity" ? <ActivityTab /> : <CashMetricsView />}
    </div>
  );
}
