"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { getShiftReportView, listShiftReceipts, listShifts, type ReceiptSummary, type ShiftReportView, type ShiftSummary } from "@/lib/actions/cashier";
import { formatKobo } from "@/lib/money";
import { ReceiptList } from "./receipt-list";
import { ShiftReportDocument } from "./shift-report";

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Super Admin view of the cashier desk: every cashier's shifts and receipts, with void. No issuing. */
export function CashierOverview({ initialDate, initialShifts }: { initialDate: string; initialShifts: ShiftSummary[] }) {
  const [date, setDate] = useState(initialDate);
  const [shifts, setShifts] = useState(initialShifts);
  const [selected, setSelected] = useState<string | null>(null);
  const [report, setReport] = useState<ShiftReportView | null>(null);
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadShift(id: string) {
    setSelected(id);
    setLoading(true);
    try {
      const [r, list] = await Promise.all([getShiftReportView(id), listShiftReceipts(id)]);
      setReport(r);
      setReceipts(list);
    } catch (err) {
      console.error("Failed to load shift:", err);
      toast.error("Failed to load shift");
    } finally {
      setLoading(false);
    }
  }

  async function changeDate(next: string) {
    setDate(next);
    setSelected(null);
    setReport(null);
    setReceipts([]);
    try {
      setShifts(await listShifts(next));
    } catch (err) {
      console.error("Failed to load shifts:", err);
      toast.error("Failed to load shifts");
    }
  }

  async function refreshSelected() {
    setShifts(await listShifts(date));
    if (selected) await loadShift(selected);
  }

  const dayTotal = shifts.reduce((sum, s) => sum + s.totalKobo, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Cashier shifts</h1>
          <p className="text-xs text-muted-foreground">Read-only view of every cashier, with void. Shifts opened on the chosen day, plus any still open.</p>
        </div>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Taken (shown shifts)</p>
            <p className="font-mono text-lg font-black text-emerald-700 dark:text-emerald-400">{formatKobo(dayTotal)}</p>
          </div>
          <Input type="date" className="h-11 w-44" value={date} onChange={(e) => e.target.value && changeDate(e.target.value)} aria-label="Day" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <section className="space-y-2 lg:col-span-4">
          {shifts.length === 0 ? (
            <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground">No shifts on this day.</p>
          ) : (
            shifts.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loadShift(s.id)}
                className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${selected === s.id ? "border-brand-green bg-emerald-500/10" : "border-border bg-card hover:bg-muted"}`}
              >
                <span>
                  <span className="block text-sm font-bold text-foreground">{s.cashierName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {time(s.openedAt)} – {s.closedAt ? time(s.closedAt) : "open"} · {s.receiptCount} receipt{s.receiptCount === 1 ? "" : "s"}
                    {s.voidedCount ? ` · ${s.voidedCount} voided` : ""}
                    {s.stale ? " · OPEN TOO LONG" : ""}
                  </span>
                </span>
                <span className="font-mono text-sm font-black text-foreground">{formatKobo(s.totalKobo)}</span>
              </button>
            ))
          )}
        </section>

        <section className="space-y-3 lg:col-span-8">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading shift…
            </div>
          ) : report ? (
            <>
              <ShiftReportDocument view={report} />
              <div className="rounded-xl border border-border bg-card p-3">
                <h2 className="mb-2 text-sm font-bold text-foreground">Receipts</h2>
                <ReceiptList receipts={receipts} onChanged={refreshSelected} emptyText="No receipts in this shift." />
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">Pick a shift to see its report and receipts.</p>
          )}
        </section>
      </div>
    </div>
  );
}
