import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getCashMetrics } from "@/lib/actions/cash-metrics";
import { formatKobo } from "@/lib/money";
import { SHIFT_VOID_ALERT_THRESHOLD, STALE_SHIFT_HOURS, describeVariance } from "@/lib/cashier-policy";
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from "@/lib/validators/cashier";

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
}

function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      {subtitle ? <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

const th = "py-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
const num = "py-1.5 pr-3 text-right font-mono";

export async function CashMetricsView() {
  const m = await getCashMetrics(30);
  const periodTotal = m.daily.reduce((s, d) => s + d.totalKobo, 0);
  const categoryTotal = m.categories.reduce((s, c) => s + c.totalKobo, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="border-b border-border pb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Management</span>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Metrics</h1>
      </div>

      <h2 className="text-lg font-bold text-foreground">Cash · last {m.days} days</h2>

      {m.stale.length > 0 ? (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" /> {m.stale.length} shift{m.stale.length === 1 ? "" : "s"} open longer than {STALE_SHIFT_HOURS} hours
          </p>
          <ul className="mt-1 text-foreground">
            {m.stale.map((s) => (
              <li key={s.shiftId}>
                {s.cashierName}: opened {dateTime(s.openedAt)} ({s.hoursOpen}h ago). Probably forgotten.
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Takings per day" subtitle={`Issued receipts only; voids excluded. Total ${formatKobo(periodTotal)}.`}>
            {m.daily.length === 0 ? (
              <p className="text-sm text-muted-foreground">No receipts in this period.</p>
            ) : (
              <div className="max-h-[28rem] overflow-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr>
                      <th className={th}>Day</th>
                      {PAYMENT_MODES.map((mode) => (
                        <th key={mode} className={`${th} text-right`}>{PAYMENT_MODE_LABELS[mode]}</th>
                      ))}
                      <th className={`${th} text-right`}>Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {m.daily.map((d) => (
                      <tr key={d.day}>
                        <td className="py-1.5 pr-3 whitespace-nowrap">{dayLabel(d.day)}</td>
                        {PAYMENT_MODES.map((mode) => (
                          <td key={mode} className={`${num} text-muted-foreground`}>{d.byMode[mode] ? formatKobo(d.byMode[mode]) : "—"}</td>
                        ))}
                        <td className={`${num} font-bold`}>{formatKobo(d.totalKobo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
        <Section title="By service category" subtitle="Share of takings in the period.">
          {m.categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {m.categories.map((c) => (
                  <tr key={c.category}>
                    <td className="py-1.5 pr-2">{c.category}</td>
                    <td className="py-1.5 pr-2 text-right text-xs text-muted-foreground">
                      {categoryTotal ? `${Math.round((c.totalKobo / categoryTotal) * 100)}%` : ""}
                    </td>
                    <td className="py-1.5 text-right font-mono font-semibold">{formatKobo(c.totalKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <Section
        title="Cashiers worth a conversation"
        subtitle="Compared with the other cashiers over the same period. A flag is something to ask about, not an accusation: busy shifts, change shortages and new staff all cause it."
      >
        {m.cashiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cashier activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr>
                  <th className={th}>Cashier</th>
                  <th className={`${th} text-right`}>Shifts</th>
                  <th className={`${th} text-right`}>Receipts</th>
                  <th className={`${th} text-right`}>Voids</th>
                  <th className={`${th} text-right`}>Void rate</th>
                  <th className={`${th} text-right`}>Avg drawer difference</th>
                  <th className={th}>Worth asking about</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {m.cashiers.map((c) => (
                  <tr key={c.cashierId} className={c.flags.length ? "bg-amber-500/5" : ""}>
                    <td className="py-1.5 pr-3 font-semibold">{c.cashierName}</td>
                    <td className={num}>{c.shifts}</td>
                    <td className={num}>{c.receipts}</td>
                    <td className={num}>{c.voids}</td>
                    <td className={num}>{(c.voidRate * 100).toFixed(1)}%</td>
                    <td className={num}>{formatKobo(c.avgAbsVarianceKobo)}</td>
                    <td className="py-1.5 text-xs">
                      {c.flags.length ? (
                        <span className="font-semibold text-amber-800 dark:text-amber-300">{c.flags.join("; ")}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Shift variances, worst first" subtitle="Counted cash minus expected cash at close.">
        {m.variances.length === 0 ? (
          <p className="text-sm text-muted-foreground">No closed shifts in this period.</p>
        ) : (
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 bg-card">
                <tr>
                  <th className={th}>Cashier</th>
                  <th className={th}>Shift</th>
                  <th className={`${th} text-right`}>Variance</th>
                  <th className={`${th} text-right`}>Voids</th>
                  <th className={th}>Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {m.variances.map((v) => (
                  <tr key={v.shiftId}>
                    <td className="py-1.5 pr-3 font-semibold">
                      <Link href={`/cashier/reports/${v.shiftId}`} className="hover:underline">{v.cashierName}</Link>
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">{dateTime(v.openedAt)}</td>
                    <td className={`${num} font-bold ${v.varianceKobo ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                      {describeVariance(v.varianceKobo, formatKobo)}
                    </td>
                    <td className={`${num} ${v.voidCount > SHIFT_VOID_ALERT_THRESHOLD ? "font-bold text-rose-700 dark:text-rose-400" : ""}`}>{v.voidCount}</td>
                    <td className="py-1.5 text-xs text-muted-foreground">{v.closingNote ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Voided value per cashier per month" subtitle="Last 6 months, including receipts voided by a super admin.">
        {m.monthlyVoids.length === 0 ? (
          <p className="text-sm text-muted-foreground">No receipts yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className={th}>Month</th>
                <th className={th}>Cashier</th>
                <th className={`${th} text-right`}>Voids</th>
                <th className={`${th} text-right`}>Voided value</th>
                <th className={`${th} text-right`}>Receipts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {m.monthlyVoids.map((v) => (
                <tr key={`${v.month}-${v.cashierName}`}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{monthLabel(v.month)}</td>
                  <td className="py-1.5 pr-3">{v.cashierName}</td>
                  <td className={num}>{v.voidCount}</td>
                  <td className={`${num} font-semibold`}>{formatKobo(v.voidKobo)}</td>
                  <td className={`${num} text-muted-foreground`}>{v.receiptCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
