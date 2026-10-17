"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendShiftReport, type ShiftReportView } from "@/lib/actions/cashier";
import { formatKobo } from "@/lib/money";
import { SHIFT_VOID_ALERT_THRESHOLD, describeVariance } from "@/lib/cashier-policy";
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from "@/lib/validators/cashier";

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        tone === "bad" ? "border-rose-400 bg-rose-500/10" : tone === "good" ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-card"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-mono text-xl font-black ${tone === "bad" ? "text-rose-700 dark:text-rose-400" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

/**
 * The shift report. For a closed shift this renders the immutable snapshot
 * stored at close, so reopening it later shows exactly what was sent.
 */
export function ShiftReportDocument({ view, onSent }: { view: ShiftReportView; onSent?: () => void }) {
  const { snapshot: r, stored } = view;
  const [sentAt, setSentAt] = useState(view.reportSentAt);
  const [sending, setSending] = useState(false);
  const variance = r.cash.varianceKobo;
  const voidHigh = r.totals.voidCount > SHIFT_VOID_ALERT_THRESHOLD;

  async function handleSend() {
    setSending(true);
    try {
      const res = await sendShiftReport(r.shift.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setSentAt(new Date().toISOString());
      toast.success(
        `Sent to ${res.recipients} super admin${res.recipients === 1 ? "" : "s"}${
          res.emailConfigured ? `, ${res.emailed} emailed` : ". Email isn't set up yet, so it went as an in-app message only"
        }`,
      );
      onSent?.();
    } catch (err) {
      console.error("Send failed:", err);
      toast.error("Could not send the report");
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="mx-auto max-w-4xl space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cashier shift report</p>
          <h1 className="text-xl font-black text-foreground">{r.shift.cashierName}</h1>
          <p className="text-sm text-muted-foreground">
            {dateTime(r.shift.openedAt)} → {r.shift.closedAt ? dateTime(r.shift.closedAt) : "still open"} · {duration(r.shift.durationMinutes)}
          </p>
          {!stored ? <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-400">Live figures: this shift is still open.</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button type="button" variant="outline" className="h-11 gap-1.5" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          {sentAt ? (
            <span className="inline-flex h-11 items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Sent {dateTime(sentAt)}
            </span>
          ) : view.canSend ? (
            <Button type="button" className="h-11 gap-1.5 bg-brand-green text-white hover:bg-emerald-700" disabled={sending} onClick={handleSend}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send to management
            </Button>
          ) : null}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Receipts issued" value={String(r.totals.issuedCount)} />
        <Tile label="Total taken" value={formatKobo(r.totals.issuedKobo)} tone="good" />
        <Tile label={`Voids${voidHigh ? " (high)" : ""}`} value={`${r.totals.voidCount} · ${formatKobo(r.totals.voidKobo)}`} tone={voidHigh ? "bad" : undefined} />
        <Tile
          label="Drawer variance"
          value={variance === null ? "Not counted" : describeVariance(variance, formatKobo)}
          tone={variance === null ? undefined : variance === 0 ? "good" : "bad"}
        />
      </section>
      {voidHigh ? (
        <p className="flex items-center gap-2 rounded-lg border border-rose-400 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-700 dark:text-rose-400">
          <AlertTriangle className="h-4 w-4" /> More than {SHIFT_VOID_ALERT_THRESHOLD} voids in one shift. Flagged for management.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-bold text-foreground">By payment mode</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {PAYMENT_MODES.map((m) => (
                <tr key={m}>
                  <td className="py-1.5 text-muted-foreground">{PAYMENT_MODE_LABELS[m]}</td>
                  <td className="py-1.5 text-right text-muted-foreground">{r.byMode[m].count}</td>
                  <td className="py-1.5 text-right font-mono font-semibold text-foreground">{formatKobo(r.byMode[m].totalKobo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-bold text-foreground">By service category</h2>
          {r.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing taken.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {r.byCategory.map((c) => (
                  <tr key={c.category}>
                    <td className="py-1.5 text-muted-foreground">{c.category}</td>
                    <td className="py-1.5 text-right font-mono font-semibold text-foreground">{formatKobo(c.totalKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold text-foreground">Cash reconciliation</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
          <dt className="text-muted-foreground">Opening float</dt>
          <dd className="text-right font-mono sm:col-span-2 sm:text-left">{formatKobo(r.cash.openingFloatKobo)}</dd>
          <dt className="text-muted-foreground">Cash taken</dt>
          <dd className="text-right font-mono sm:col-span-2 sm:text-left">+ {formatKobo(r.cash.cashTakenKobo)}</dd>
          <dt className="font-semibold text-foreground">Expected in drawer</dt>
          <dd className="text-right font-mono font-bold sm:col-span-2 sm:text-left">{formatKobo(r.cash.expectedCashKobo)}</dd>
          <dt className="text-muted-foreground">Counted</dt>
          <dd className="text-right font-mono sm:col-span-2 sm:text-left">{r.cash.countedCashKobo === null ? "—" : formatKobo(r.cash.countedCashKobo)}</dd>
          <dt className="font-semibold text-foreground">Variance</dt>
          <dd className={`text-right font-mono font-bold sm:col-span-2 sm:text-left ${variance ? "text-rose-700 dark:text-rose-400" : ""}`}>
            {variance === null ? "—" : describeVariance(variance, formatKobo)}
          </dd>
          {r.cash.closingNote ? (
            <>
              <dt className="text-muted-foreground">Note</dt>
              <dd className="sm:col-span-2">{r.cash.closingNote}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold text-foreground">Receipts ({r.receipts.length})</h2>
        {r.receipts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No receipts in this shift.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-2">Nº</th>
                  <th className="py-2 pr-2">Time</th>
                  <th className="py-2 pr-2">Payer</th>
                  <th className="py-2 pr-2">Services</th>
                  <th className="py-2 pr-2">Mode</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {r.receipts.map((x) => {
                  const voided = x.status === "voided";
                  return (
                    <tr key={x.receiptNo} className={voided ? "bg-rose-500/5" : ""}>
                      <td className={`py-1.5 pr-2 font-mono ${voided ? "line-through text-muted-foreground" : ""}`}>{x.receiptNo}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{new Date(x.issuedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className={`py-1.5 pr-2 ${voided ? "line-through text-muted-foreground" : ""}`}>{x.payerName}</td>
                      <td className="py-1.5 pr-2">
                        <span className={voided ? "line-through text-muted-foreground" : ""}>{x.services}</span>
                        {voided ? (
                          <span className="block font-semibold text-rose-700 dark:text-rose-400">
                            VOIDED{x.voidedByName ? ` by ${x.voidedByName}` : ""}: {x.voidReason}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1.5 pr-2">{PAYMENT_MODE_LABELS[x.paymentMode]}</td>
                      <td className={`py-1.5 text-right font-mono font-bold ${voided ? "line-through text-muted-foreground" : ""}`}>{formatKobo(x.totalKobo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {stored ? <p className="text-center text-[11px] text-muted-foreground">Snapshot stored at close on {dateTime(r.generatedAt)}. It does not change afterwards.</p> : null}
    </article>
  );
}
