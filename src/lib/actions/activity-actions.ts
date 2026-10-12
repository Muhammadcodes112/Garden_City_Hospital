"use server";

import { requireSuperAdmin } from "@/lib/authz";
import { activityEvents } from "@/db/schema";
import { type ActivityCategory, type ActorRole } from "@/lib/activity";
import postgres from "postgres";

export type { ActivityCategory, ActorRole };

export type ActivityFilters = {
  search?: string;
  category?: ActivityCategory | "all";
  actorId?: string;
  from?: string; // ISO date string
  to?: string;   // ISO date string
};

export type ActivityEventItem = {
  id: string;
  occurredAt: string; // ISO string
  formattedDate: string; // DD/MM/YYYY HH:mm:ss in Africa/Lagos
  actorId: string | null;
  actorRoleAtTime: ActorRole | null;
  actorLabel: string | null;
  category: ActivityCategory;
  action: string;
  targetType: string | null;
  targetId: string | null;
  summary: string;
  ipHash: string | null;
  userAgent: string | null;
  clientBrowser: string;
  maskedClientIp: string;
  metadata: Record<string, unknown>;
  needsAttention: boolean;
  attentionReasons: string[];
};

export type SignalsData = {
  eventsToday: number;
  failedSignins: number;
  recordsDeleted: number;
  afterHoursAccess: number;
};

export type CategoryCountItem = {
  category: string;
  count: number;
};

export type ActorOption = {
  id: string;
  label: string;
  role?: string | null;
};

export type ActivityEventsResponse = {
  items: ActivityEventItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  return postgres(process.env.DATABASE_URL, { prepare: false });
}

import {
  formatLagosDateTime,
  parseUserAgent,
  isAfterHoursLagos,
} from "@/lib/activity-utils";

export {
  formatLagosDateTime,
  parseUserAgent,
  isAfterHoursLagos,
};

/**
 * Returns signals metrics for the last 24h / today:
 * - events today
 * - failed sign-ins (warning)
 * - records deleted (warning)
 * - after-hours access (22:00–06:00 Africa/Lagos) (warning)
 */
export async function getActivitySignals(): Promise<SignalsData> {
  await requireSuperAdmin();
  const sql = getSql();

  try {
    const [row] = await sql<
      {
        total_today: number;
        failed_signins_today: number;
        records_deleted_today: number;
        after_hours_today: number;
      }[]
    >`
      SELECT
        COUNT(*)::int as total_today,
        COUNT(*) FILTER (WHERE action = 'signin.failed')::int as failed_signins_today,
        COUNT(*) FILTER (WHERE action IN ('record.deleted', 'record.permanently_deleted', 'account.deleted'))::int as records_deleted_today,
        COUNT(*) FILTER (
          WHERE EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'Africa/Lagos') >= 22
             OR EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'Africa/Lagos') < 6
        )::int as after_hours_today
      FROM activity_events
      WHERE occurred_at >= (now() - interval '24 hours');
    `;

    return {
      eventsToday: row?.total_today ?? 0,
      failedSignins: row?.failed_signins_today ?? 0,
      recordsDeleted: row?.records_deleted_today ?? 0,
      afterHoursAccess: row?.after_hours_today ?? 0,
    };
  } finally {
    await sql.end();
  }
}

/**
 * Returns category counts and list of actors for filter bar.
 */
export async function getActivityFilterMeta(): Promise<{
  categoryCounts: Record<string, number>;
  totalEvents: number;
  actors: ActorOption[];
}> {
  await requireSuperAdmin();
  const sql = getSql();

  try {
    const [countsRows, actorRows] = await Promise.all([
      sql<{ category: string; count: number }[]>`
        SELECT category::text, COUNT(*)::int as count
        FROM activity_events
        GROUP BY category;
      `,
      sql<{ actor_id: string; actor_label: string; actor_role_at_time: string | null }[]>`
        SELECT DISTINCT actor_id, actor_label, actor_role_at_time::text
        FROM activity_events
        WHERE actor_id IS NOT NULL AND actor_label IS NOT NULL
        ORDER BY actor_label ASC
        LIMIT 100;
      `,
    ]);

    const counts: Record<string, number> = {
      all: 0,
      auth: 0,
      records: 0,
      sharing: 0,
      messages: 0,
      appointments: 0,
      accounts: 0,
    };

    let total = 0;
    for (const r of countsRows) {
      counts[r.category] = r.count;
      total += r.count;
    }
    counts.all = total;

    const actors: ActorOption[] = actorRows.map((a) => ({
      id: a.actor_id,
      label: a.actor_label,
      role: a.actor_role_at_time,
    }));

    return {
      categoryCounts: counts,
      totalEvents: total,
      actors,
    };
  } finally {
    await sql.end();
  }
}

/**
 * Keyset-paginated activity log query on (occurred_at DESC, id DESC).
 * Cursor is base64 encoded { occurredAt: ISOString, id: string }.
 */
export async function getActivityEvents(
  filters: ActivityFilters = {},
  cursor?: string | null,
  limit: number = 50,
): Promise<ActivityEventsResponse> {
  await requireSuperAdmin();
  const sql = getSql();

  try {
    let cursorOccurredAt: Date | null = null;
    let cursorId: string | null = null;

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
        if (decoded.occurredAt && decoded.id) {
          cursorOccurredAt = new Date(decoded.occurredAt);
          cursorId = decoded.id;
        }
      } catch {
        // ignore invalid cursor
      }
    }

    const conditions: postgres.PendingQuery<any>[] = [];

    // Category filter
    if (filters.category && filters.category !== "all") {
      conditions.push(sql`category = ${filters.category}`);
    }

    // Actor filter
    if (filters.actorId) {
      conditions.push(sql`actor_id = ${filters.actorId}`);
    }

    // Date from
    if (filters.from) {
      const fromDate = new Date(filters.from);
      if (!isNaN(fromDate.getTime())) {
        conditions.push(sql`occurred_at >= ${fromDate}`);
      }
    }

    // Date to
    if (filters.to) {
      const toDate = new Date(filters.to);
      if (!isNaN(toDate.getTime())) {
        // set to end of day if only date is passed
        if (filters.to.length <= 10) {
          toDate.setHours(23, 59, 59, 999);
        }
        conditions.push(sql`occurred_at <= ${toDate}`);
      }
    }

    // Search filter
    if (filters.search && filters.search.trim().length > 0) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(sql`(
        summary ILIKE ${term} OR
        actor_label ILIKE ${term} OR
        action ILIKE ${term} OR
        target_id ILIKE ${term}
      )`);
    }

    // Keyset pagination condition: (occurred_at, id) < (cursorOccurredAt, cursorId)
    if (cursorOccurredAt && cursorId) {
      conditions.push(sql`(occurred_at, id) < (${cursorOccurredAt}, ${cursorId})`);
    }

    const whereClause =
      conditions.length > 0
        ? sql`WHERE ${conditions.reduce((acc, curr) => sql`${acc} AND ${curr}`)}`
        : sql``;

    // Fetch limit + 1 to know if there's a next page
    const fetchLimit = limit + 1;

    const rows = await sql<
      {
        id: string;
        occurred_at: Date;
        actor_id: string | null;
        actor_role_at_time: ActorRole | null;
        actor_label: string | null;
        category: ActivityCategory;
        action: string;
        target_type: string | null;
        target_id: string | null;
        summary: string;
        ip_hash: string | null;
        user_agent: string | null;
        metadata: Record<string, unknown> | null;
      }[]
    >`
      SELECT
        id,
        occurred_at,
        actor_id,
        actor_role_at_time,
        actor_label,
        category,
        action,
        target_type,
        target_id,
        summary,
        ip_hash,
        user_agent,
        metadata
      FROM activity_events
      ${whereClause}
      ORDER BY occurred_at DESC, id DESC
      LIMIT ${fetchLimit};
    `;

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({
          occurredAt: last.occurred_at.toISOString(),
          id: last.id,
        }),
      ).toString("base64");
    }

    const items: ActivityEventItem[] = pageRows.map((r) => {
      const formattedDate = formatLagosDateTime(r.occurred_at);
      const afterHours = isAfterHoursLagos(r.occurred_at);
      const isDeletion =
        r.action.includes("delete") ||
        r.action === "record.deleted" ||
        r.action === "record.permanently_deleted" ||
        r.action === "account.deleted";
      const isFailedSignIn = r.action === "signin.failed";
      const isRoleChange = r.action === "role.changed" || r.action.includes("role");

      const attentionReasons: string[] = [];
      if (isDeletion) attentionReasons.push("Deletion");
      if (isFailedSignIn) attentionReasons.push("Failed Sign-in");
      if (isRoleChange) attentionReasons.push("Role Change");
      if (afterHours) attentionReasons.push("After Hours (22:00–06:00)");

      const needsAttention = attentionReasons.length > 0;

      // Masked IP representation
      let maskedClientIp = "Masked IP";
      if (r.metadata && typeof r.metadata.ipAddress === "string") {
        const parts = (r.metadata.ipAddress as string).split(".");
        if (parts.length === 4) {
          maskedClientIp = `${parts[0]}.${parts[1]}.***.***`;
        } else {
          maskedClientIp = (r.metadata.ipAddress as string).slice(0, 7) + "***";
        }
      } else if (r.ip_hash) {
        maskedClientIp = `Hash: #${r.ip_hash.slice(0, 8)}…`;
      }

      return {
        id: r.id,
        occurredAt: r.occurred_at.toISOString(),
        formattedDate,
        actorId: r.actor_id,
        actorRoleAtTime: r.actor_role_at_time,
        actorLabel: r.actor_label,
        category: r.category,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        summary: r.summary,
        ipHash: r.ip_hash,
        userAgent: r.user_agent,
        clientBrowser: parseUserAgent(r.user_agent),
        maskedClientIp,
        metadata: r.metadata ?? {},
        needsAttention,
        attentionReasons,
      };
    });

    return {
      items,
      nextCursor,
      hasMore,
    };
  } finally {
    await sql.end();
  }
}
