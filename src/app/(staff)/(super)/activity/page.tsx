import { requireSuperAdmin } from "@/lib/authz";
import {
  getActivitySignals,
  getActivityFilterMeta,
  getActivityEvents,
} from "@/lib/actions/activity-actions";
import { ActivityLogView } from "@/components/admin/activity-log-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activity Log | Garden City Specialist Hospital",
  description: "Immutable append-only system audit trail and security signals.",
};

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  await requireSuperAdmin();

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
