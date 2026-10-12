import { requireSuperAdmin } from "@/lib/authz";
import postgres from "postgres";
import {
  formatLagosDateTime,
  parseUserAgent,
  isAfterHoursLagos,
} from "@/lib/actions/activity-actions";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  await requireSuperAdmin();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const category = searchParams.get("category") || undefined;
  const actorId = searchParams.get("actorId") || undefined;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  if (!process.env.DATABASE_URL) {
    return new Response("DATABASE_URL not set", { status: 500 });
  }

  const sql = postgres(process.env.DATABASE_URL, { prepare: false });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // CSV Header
        const header = [
          "Timestamp (WAT)",
          "Actor",
          "Role",
          "Category",
          "Action",
          "Summary",
          "Target Type",
          "Target ID",
          "Client Browser",
          "Masked IP",
          "Needs Attention",
        ].join(",") + "\r\n";
        controller.enqueue(encoder.encode(header));

        let lastOccurredAt: Date | null = null;
        let lastId: string | null = null;
        const batchSize = 1000;
        let keepGoing = true;

        while (keepGoing) {
          const conditions: postgres.PendingQuery<any>[] = [];

          if (category && category !== "all") {
            conditions.push(sql`category = ${category}`);
          }
          if (actorId) {
            conditions.push(sql`actor_id = ${actorId}`);
          }
          if (from) {
            const fDate = new Date(from);
            if (!isNaN(fDate.getTime())) conditions.push(sql`occurred_at >= ${fDate}`);
          }
          if (to) {
            const tDate = new Date(to);
            if (!isNaN(tDate.getTime())) {
              if (to.length <= 10) tDate.setHours(23, 59, 59, 999);
              conditions.push(sql`occurred_at <= ${tDate}`);
            }
          }
          if (search && search.trim().length > 0) {
            const term = `%${search.trim()}%`;
            conditions.push(sql`(
              summary ILIKE ${term} OR
              actor_label ILIKE ${term} OR
              action ILIKE ${term} OR
              target_id ILIKE ${term}
            )`);
          }

          if (lastOccurredAt && lastId) {
            conditions.push(sql`(occurred_at, id) < (${lastOccurredAt}, ${lastId})`);
          }

          const whereClause =
            conditions.length > 0
              ? sql`WHERE ${conditions.reduce((acc, curr) => sql`${acc} AND ${curr}`)}`
              : sql``;

          const rows = await sql<
            {
              id: string;
              occurred_at: Date;
              actor_id: string | null;
              actor_role_at_time: string | null;
              actor_label: string | null;
              category: string;
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
            LIMIT ${batchSize};
          `;

          if (rows.length === 0) {
            keepGoing = false;
            break;
          }

          let chunk = "";
          for (const r of rows) {
            const lagosTime = formatLagosDateTime(r.occurred_at);
            const browser = parseUserAgent(r.user_agent);
            const afterHours = isAfterHoursLagos(r.occurred_at);
            const isDeletion =
              r.action.includes("delete") ||
              r.action === "record.deleted" ||
              r.action === "record.permanently_deleted" ||
              r.action === "account.deleted";
            const isFailedSignIn = r.action === "signin.failed";
            const isRoleChange = r.action === "role.changed" || r.action.includes("role");
            const needsAttention = isDeletion || isFailedSignIn || isRoleChange || afterHours;

            let maskedIp = "";
            if (r.metadata && typeof r.metadata.ipAddress === "string") {
              const parts = (r.metadata.ipAddress as string).split(".");
              maskedIp = parts.length === 4 ? `${parts[0]}.${parts[1]}.***.***` : (r.metadata.ipAddress as string).slice(0, 7) + "***";
            } else if (r.ip_hash) {
              maskedIp = `#${r.ip_hash.slice(0, 8)}…`;
            }

            const rowCsv = [
              escapeCsv(lagosTime),
              escapeCsv(r.actor_label || "Unknown"),
              escapeCsv(r.actor_role_at_time || "none"),
              escapeCsv(r.category),
              escapeCsv(r.action),
              escapeCsv(r.summary),
              escapeCsv(r.target_type || ""),
              escapeCsv(r.target_id || ""),
              escapeCsv(browser),
              escapeCsv(maskedIp),
              escapeCsv(needsAttention ? "YES" : "NO"),
            ].join(",") + "\r\n";

            chunk += rowCsv;
          }

          controller.enqueue(encoder.encode(chunk));

          if (rows.length < batchSize) {
            keepGoing = false;
          } else {
            const lastRow = rows[rows.length - 1];
            lastOccurredAt = lastRow.occurred_at;
            lastId = lastRow.id;
          }
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        await sql.end();
      }
    },
  });

  const todayStr = new Date().toISOString().split("T")[0];
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="activity_events_${todayStr}.csv"`,
      "Cache-Control": "no-cache, no-store",
    },
  });
}
