"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireSuperAdmin } from "@/lib/authz";
import { STALE_SHIFT_HOURS } from "@/lib/cashier-policy";
import type { PaymentMode } from "@/lib/validators/cashier";

/**
 * Cash section of the Metrics page (Super Admin). Voided receipts never count
 * toward takings; they're reported on their own. Days are Lagos calendar days.
 */

export type DailyTakings = { day: string; byMode: Record<PaymentMode, number>; totalKobo: number };
export type CategoryTakings = { category: string; totalKobo: number };
export type ShiftVariance = {
  shiftId: string;
  cashierName: string;
  openedAt: string;
  closedAt: string;
  varianceKobo: number;
  closingNote: string | null;
  voidCount: number;
};
export type MonthlyVoids = { month: string; cashierName: string; voidCount: number; voidKobo: number; receiptCount: number };
export type CashierRates = {
  cashierId: string;
  cashierName: string;
  shifts: number;
  receipts: number;
  voids: number;
  voidRate: number;
  avgAbsVarianceKobo: number;
  /** Plain-language reasons this cashier stands out from the others; empty if not. */
  flags: string[];
};
export type StaleShift = { shiftId: string; cashierName: string; openedAt: string; hoursOpen: number };

export type CashMetrics = {
  days: number;
  daily: DailyTakings[];
  categories: CategoryTakings[];
  variances: ShiftVariance[];
  monthlyVoids: MonthlyVoids[];
  cashiers: CashierRates[];
  stale: StaleShift[];
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

// Outlier rule: noticeably above the OTHER cashiers' median, and above a floor
// so tiny numbers don't trigger it. Meant as "worth asking about", not proof.
const VOID_RATE_FLOOR = 0.05; // 5% of receipts
const VARIANCE_FLOOR_KOBO = 100_000; // ₦1,000 average per shift
const OUTLIER_MULTIPLE = 2;

export async function getCashMetrics(days = 30): Promise<CashMetrics> {
  await requireSuperAdmin();
  const span = Math.min(Math.max(Math.trunc(days) || 30, 7), 366);
  const since = sql`(now() AT TIME ZONE 'Africa/Lagos')::date - ${span - 1}::int`;
  const lagosDay = sql`(r.issued_at AT TIME ZONE 'Africa/Lagos')::date`;

  const dailyRows = await db.execute<{ day: string; mode: PaymentMode; total: string }>(sql`
    SELECT to_char(${lagosDay}, 'YYYY-MM-DD') AS day, r.payment_mode AS mode, sum(r.total_kobo)::bigint AS total
    FROM receipts r
    WHERE r.status = 'issued' AND ${lagosDay} >= ${since}
    GROUP BY 1, 2 ORDER BY 1 DESC`);
  const dailyMap = new Map<string, DailyTakings>();
  for (const r of dailyRows) {
    const d = dailyMap.get(r.day) ?? { day: r.day, byMode: { cash: 0, transfer: 0, pos: 0, cheque: 0 }, totalKobo: 0 };
    d.byMode[r.mode] += Number(r.total);
    d.totalKobo += Number(r.total);
    dailyMap.set(r.day, d);
  }

  const categoryRows = await db.execute<{ category: string; total: string }>(sql`
    SELECT coalesce(c.name, 'Free items') AS category, sum(l.line_total_kobo)::bigint AS total
    FROM receipt_lines l
    JOIN receipts r ON r.id = l.receipt_id
    LEFT JOIN services s ON s.id = l.service_id
    LEFT JOIN service_categories c ON c.id = s.category_id
    WHERE r.status = 'issued' AND ${lagosDay} >= ${since}
    GROUP BY 1 ORDER BY 2 DESC`);

  const varianceRows = await db.execute<{
    shift_id: string; cashier_name: string; opened_at: Date; closed_at: Date; variance: string; note: string | null; voids: number;
  }>(sql`
    SELECT cs.id AS shift_id, coalesce(cs.cashier_name, u.name) AS cashier_name, cs.opened_at, cs.closed_at, cs.variance_kobo AS variance,
           cs.closing_note AS note,
           (SELECT count(*)::int FROM receipts r WHERE r.shift_id = cs.id AND r.status = 'voided') AS voids
    FROM cashier_shifts cs JOIN "user" u ON u.id = cs.cashier_id
    WHERE cs.status = 'closed' AND (cs.opened_at AT TIME ZONE 'Africa/Lagos')::date >= ${since}
    ORDER BY abs(coalesce(cs.variance_kobo, 0)) DESC, cs.opened_at DESC
    LIMIT 100`);

  const monthlyRows = await db.execute<{ month: string; cashier_name: string; voids: number; void_kobo: string; receipts: number }>(sql`
    SELECT to_char(date_trunc('month', r.issued_at AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM') AS month,
           coalesce(cs.cashier_name, u.name) AS cashier_name,
           count(*) FILTER (WHERE r.status = 'voided')::int AS voids,
           coalesce(sum(r.total_kobo) FILTER (WHERE r.status = 'voided'), 0)::bigint AS void_kobo,
           count(*)::int AS receipts
    FROM receipts r JOIN cashier_shifts cs ON cs.id = r.shift_id JOIN "user" u ON u.id = cs.cashier_id
    WHERE r.issued_at >= date_trunc('month', now()) - interval '5 months'
    GROUP BY 1, 2 ORDER BY 1 DESC, 4 DESC`);

  const rateRows = await db.execute<{ cashier_id: string; cashier_name: string; shifts: number; receipts: number; voids: number; avg_abs_var: string | null }>(sql`
    -- Cashiers share one account, so a cashier is the name typed at the start of each shift.
    WITH sh AS (
      SELECT cs.id, cs.status, cs.variance_kobo, cs.opened_at,
             coalesce(cs.cashier_name, u.name) AS name, lower(trim(coalesce(cs.cashier_name, u.name))) AS key
      FROM cashier_shifts cs JOIN "user" u ON u.id = cs.cashier_id
    ),
    shift_stats AS (
      SELECT key, max(name) AS name,
             count(*) FILTER (WHERE status = 'closed' AND (opened_at AT TIME ZONE 'Africa/Lagos')::date >= ${since})::int AS shifts,
             avg(abs(variance_kobo)) FILTER (WHERE status = 'closed' AND (opened_at AT TIME ZONE 'Africa/Lagos')::date >= ${since}) AS avg_abs_var
      FROM sh GROUP BY key
    ),
    receipt_stats AS (
      SELECT sh.key, count(*)::int AS receipts, count(*) FILTER (WHERE r.status = 'voided')::int AS voids
      FROM receipts r JOIN sh ON sh.id = r.shift_id
      WHERE ${lagosDay} >= ${since}
      GROUP BY sh.key
    )
    SELECT ss.key AS cashier_id, ss.name AS cashier_name, ss.shifts,
           coalesce(rs.receipts, 0)::int AS receipts, coalesce(rs.voids, 0)::int AS voids, ss.avg_abs_var
    FROM shift_stats ss LEFT JOIN receipt_stats rs ON rs.key = ss.key`);

  const base = rateRows
    .map((r) => ({
      cashierId: r.cashier_id,
      cashierName: r.cashier_name,
      shifts: r.shifts,
      receipts: r.receipts,
      voids: r.voids,
      voidRate: r.receipts ? r.voids / r.receipts : 0,
      avgAbsVarianceKobo: Math.round(Number(r.avg_abs_var ?? 0)),
    }))
    .filter((c) => c.shifts > 0 || c.receipts > 0);
  const cashiers: CashierRates[] = base.map((c) => {
    const others = base.filter((o) => o.cashierId !== c.cashierId);
    const flags: string[] = [];
    if (others.length > 0) {
      const otherVoid = median(others.map((o) => o.voidRate));
      const otherVar = median(others.map((o) => o.avgAbsVarianceKobo));
      if (c.voidRate >= VOID_RATE_FLOOR && c.voidRate > OUTLIER_MULTIPLE * otherVoid) {
        flags.push(`Void rate ${(c.voidRate * 100).toFixed(1)}% vs ${(otherVoid * 100).toFixed(1)}% for the others`);
      }
      if (c.avgAbsVarianceKobo >= VARIANCE_FLOOR_KOBO && c.avgAbsVarianceKobo > OUTLIER_MULTIPLE * otherVar) {
        flags.push("Drawer differences well above the others' typical shift");
      }
    }
    return { ...c, flags };
  });
  cashiers.sort((a, b) => b.flags.length - a.flags.length || b.voidRate - a.voidRate);

  const staleRows = await db.execute<{ shift_id: string; cashier_name: string; opened_at: Date }>(sql`
    SELECT cs.id AS shift_id, coalesce(cs.cashier_name, u.name) AS cashier_name, cs.opened_at
    FROM cashier_shifts cs JOIN "user" u ON u.id = cs.cashier_id
    WHERE cs.status = 'open' AND cs.opened_at < now() - make_interval(hours => ${STALE_SHIFT_HOURS})
    ORDER BY cs.opened_at`);

  return {
    days: span,
    daily: [...dailyMap.values()],
    categories: categoryRows.map((r) => ({ category: r.category, totalKobo: Number(r.total) })),
    variances: varianceRows.map((r) => ({
      shiftId: r.shift_id,
      cashierName: r.cashier_name,
      openedAt: new Date(r.opened_at).toISOString(),
      closedAt: new Date(r.closed_at).toISOString(),
      varianceKobo: Number(r.variance ?? 0),
      closingNote: r.note,
      voidCount: r.voids,
    })),
    monthlyVoids: monthlyRows.map((r) => ({
      month: r.month,
      cashierName: r.cashier_name,
      voidCount: r.voids,
      voidKobo: Number(r.void_kobo),
      receiptCount: r.receipts,
    })),
    cashiers,
    stale: staleRows.map((r) => ({
      shiftId: r.shift_id,
      cashierName: r.cashier_name,
      openedAt: new Date(r.opened_at).toISOString(),
      hoursOpen: Math.floor((Date.now() - new Date(r.opened_at).getTime()) / 3_600_000),
    })),
  };
}

/** Lightweight check for the dashboard banner. */
export async function getStaleShiftCount(): Promise<number> {
  await requireSuperAdmin();
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM cashier_shifts
    WHERE status = 'open' AND opened_at < now() - make_interval(hours => ${STALE_SHIFT_HOURS})`);
  return row?.n ?? 0;
}
