"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote, CheckCircle2, Clock, CreditCard, FileText, History, Landmark, Loader2, Minus, Plus, Printer, Search, Smartphone, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  closeShift,
  getCloseSummary,
  getMyOpenShift,
  getPatientReceiptHistory,
  listShiftReceipts,
  searchPatientsForCashier,
  startShift,
  type CashierPatient,
  type ReceiptSummary,
  type SaleCategory,
  type SaleService,
  type ShiftSummary,
} from "@/lib/actions/cashier";
import type { ShiftReportSnapshot } from "@/lib/cashier-service";
import { STALE_SHIFT_HOURS, SHIFT_VOID_ALERT_THRESHOLD, describeVariance } from "@/lib/cashier-policy";
import { formatKobo, parseNairaToKobo } from "@/lib/money";
import { FOLDER_SWATCH } from "@/lib/folder-colours";
import { PAYMENT_MODES, PAYMENT_MODE_LABELS, type PaymentMode } from "@/lib/validators/cashier";
import { ReceiptList, printReceipt } from "./receipt-list";

type DeskLine = {
  key: string;
  serviceId: string;
  name: string;
  /** Fixed catalogue price; null when the amount is typed ("Others"). */
  unitPriceKobo: number | null;
  qty: number;
  description: string;
  amount: string;
};

const MODE_ICONS: Record<PaymentMode, typeof Banknote> = {
  cash: Banknote,
  transfer: Smartphone,
  pos: CreditCard,
  cheque: Landmark,
};

function lineTotal(l: DeskLine): number {
  const unit = l.unitPriceKobo ?? parseNairaToKobo(l.amount) ?? 0;
  return unit * l.qty;
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function CashierDesk({
  cashierName,
  initialShift,
  initialReceipts,
  catalogue,
}: {
  cashierName: string;
  initialShift: ShiftSummary | null;
  initialReceipts: ReceiptSummary[];
  catalogue: SaleCategory[];
}) {
  const router = useRouter();
  const [shift, setShift] = useState(initialShift);
  const [receipts, setReceipts] = useState(initialReceipts);
  const [busy, setBusy] = useState(false);

  // Patient / payer
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CashierPatient[]>([]);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState<CashierPatient | null>(null);
  const [history, setHistory] = useState<ReceiptSummary[] | null>(null);
  const [notRegistered, setNotRegistered] = useState(false);
  const [payerName, setPayerName] = useState("");

  // Basket
  const [lines, setLines] = useState<DeskLine[]>([]);
  const [mode, setMode] = useState<PaymentMode | null>(null);
  const [ref, setRef] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [lastIssued, setLastIssued] = useState<{ id: string; receiptNo: string; payer: string; totalKobo: number } | null>(null);

  // Shift start / close
  const [openingFloat, setOpeningFloat] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeSummary, setCloseSummary] = useState<ShiftReportSnapshot | null>(null);
  const [counted, setCounted] = useState("");
  const [closeNote, setCloseNote] = useState("");

  async function refresh() {
    const s = await getMyOpenShift();
    setShift(s);
    setReceipts(s ? await listShiftReceipts(s.id) : []);
  }

  // Debounced patient search (state updates happen in the timer callback, not the effect body).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchPatientsForCashier(q)
        .then((rows) => !cancelled && setResults(rows))
        .catch((err) => console.error("Patient search failed:", err))
        .finally(() => !cancelled && setSearching(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  function pickPatient(p: CashierPatient) {
    setPatient(p);
    setPayerName(`${p.firstNames} ${p.surname}`.trim());
    setQuery("");
    setResults([]);
    setHistory(null);
    getPatientReceiptHistory(p.id)
      .then(setHistory)
      .catch((err) => {
        console.error("History failed:", err);
        setHistory([]);
      });
  }

  function clearPatient() {
    setPatient(null);
    setHistory(null);
    setPayerName("");
  }

  function addService(s: SaleService) {
    if (s.allowCustomAmount) {
      setLines((prev) => [
        ...prev,
        { key: crypto.randomUUID(), serviceId: s.id, name: s.name, unitPriceKobo: null, qty: 1, description: "", amount: "" },
      ]);
      return;
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.serviceId === s.id && l.unitPriceKobo !== null);
      if (existing) return prev.map((l) => (l.key === existing.key ? { ...l, qty: Math.min(999, l.qty + 1) } : l));
      return [...prev, { key: crypto.randomUUID(), serviceId: s.id, name: s.name, unitPriceKobo: s.priceKobo, qty: 1, description: "", amount: "" }];
    });
  }

  function updateLine(key: string, patch: Partial<DeskLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const total = useMemo(() => lines.reduce((sum, l) => sum + lineTotal(l), 0), [lines]);
  const linesValid = lines.length > 0 && lines.every((l) => lineTotal(l) > 0);
  const canIssue =
    Boolean(shift) &&
    payerName.trim().length > 0 &&
    linesValid &&
    mode !== null &&
    (mode !== "cheque" || chequeNo.trim().length > 0) &&
    (notRegistered || patient !== null);

  function resetReceipt() {
    setLines([]);
    setMode(null);
    setRef("");
    setChequeNo("");
    clearPatient();
    setNotRegistered(false);
  }

  async function handleIssue() {
    if (!canIssue || !mode) return;
    setBusy(true);
    try {
      const response = await fetch("/api/cashier/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        patientId: notRegistered ? null : patient?.id ?? null,
        payerName: payerName.trim(),
        paymentMode: mode,
        tellerOrTransferRef: ref.trim() || undefined,
        chequeNo: chequeNo.trim() || undefined,
        lines: lines.map((l) => ({
          serviceId: l.serviceId,
          qty: l.qty,
          amount: l.unitPriceKobo === null ? l.amount : undefined,
          description: l.unitPriceKobo === null ? l.description.trim() || undefined : undefined,
        })),
        }),
      });
      const res = (await response.json().catch(() => ({}))) as { receiptId?: string; receiptNo?: string; error?: string };
      if (!response.ok || !res.receiptId || !res.receiptNo) {
        toast.error(res.error ?? "Could not issue the receipt");
        return;
      }
      setLastIssued({ id: res.receiptId, receiptNo: res.receiptNo, payer: payerName.trim(), totalKobo: total });
      toast.success(`Receipt Nº ${res.receiptNo} issued`);
      resetReceipt();
      await refresh();
    } catch (err) {
      console.error("Issue failed:", err);
      toast.error("Could not issue the receipt. Nothing was charged; try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    setBusy(true);
    try {
      const res = await startShift(openingFloat.trim() || "0");
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setShift(res.shift);
      setReceipts(await listShiftReceipts(res.shift.id));
      setOpeningFloat("");
    } finally {
      setBusy(false);
    }
  }

  async function openCloseDialog() {
    setClosing(true);
    setCloseSummary(null);
    setCounted("");
    setCloseNote("");
    try {
      setCloseSummary(await getCloseSummary());
    } catch (err) {
      console.error("Close summary failed:", err);
      toast.error("Could not load the shift totals");
      setClosing(false);
    }
  }

  const countedKobo = counted.trim() ? parseNairaToKobo(counted) : null;
  const variance = closeSummary && countedKobo !== null ? countedKobo - closeSummary.cash.expectedCashKobo : null;
  const canClose = countedKobo !== null && (variance === 0 || closeNote.trim().length > 0);

  async function handleClose() {
    if (!canClose) return;
    setBusy(true);
    try {
      const res = await closeShift({ counted, note: closeNote });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Shift closed");
      router.push(`/cashier/reports/${res.shiftId}`);
    } catch (err) {
      console.error("Close failed:", err);
      toast.error("Could not close the shift");
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------------------
  // No open shift: only Start shift (plus the report of the shift just closed).
  // ---------------------------------------------------------------------------
  if (!shift) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-5 py-10 text-center">
        <div>
          <p className="text-lg font-bold text-foreground">Hello, {cashierName}</p>
          <p className="mt-1 text-sm text-muted-foreground">Start a shift to begin issuing receipts. The time is recorded automatically.</p>
        </div>
        <div className="w-full space-y-1 text-left">
          <Label htmlFor="float">Opening float: cash already in the drawer</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
            <Input id="float" className="h-14 pl-7 text-lg" inputMode="decimal" placeholder="0" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} />
          </div>
        </div>
        <Button type="button" onClick={handleStart} disabled={busy || (openingFloat.trim() !== "" && parseNairaToKobo(openingFloat) === null)} className="h-16 w-full gap-2 bg-brand-green text-lg font-bold text-white hover:bg-emerald-700">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clock className="h-5 w-5" />} Start shift
        </Button>
        <Link href="/cashier/reports" className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <History className="h-4 w-4" /> My past shift reports
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 1. SHIFT STRIP */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">On shift</p>
          <p className="text-sm font-bold text-foreground">{cashierName}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Opened</p>
          <p className="text-sm font-semibold text-foreground">{time(shift.openedAt)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Receipts</p>
          <p className="text-sm font-semibold text-foreground">
            {shift.receiptCount}
            {shift.voidedCount ? <span className="text-muted-foreground"> ({shift.voidedCount} voided)</span> : null}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total taken</p>
          <p className="font-mono text-lg font-black text-emerald-700 dark:text-emerald-400">{formatKobo(shift.totalKobo)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Opening float</p>
          <p className="font-mono text-sm font-semibold text-foreground">{formatKobo(shift.openingFloatKobo)}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" className="h-11 gap-1.5">
            <Link href="/cashier/reports">
              <History className="h-4 w-4" /> Past shifts
            </Link>
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={openCloseDialog}>
            Close shift
          </Button>
        </div>
      </div>
      {shift.stale ? (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" /> This shift has been open over {STALE_SHIFT_HOURS} hours and has been flagged to management. Close it if your shift has ended.
        </p>
      ) : null}

      {lastIssued ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <p className="flex-1 text-sm text-foreground">
            Receipt <span className="font-mono font-bold">Nº {lastIssued.receiptNo}</span> issued to {lastIssued.payer} for{" "}
            <span className="font-bold">{formatKobo(lastIssued.totalKobo)}</span>
          </p>
          <Button type="button" className="h-11 gap-1.5" onClick={() => printReceipt(lastIssued.id).then(refresh)}>
            <Printer className="h-4 w-4" /> Print receipt
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11" onClick={() => setLastIssued(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* 2. NEW RECEIPT (left) */}
        <section className="space-y-3 lg:col-span-8">
          {/* Patient */}
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <UserRound className="h-4 w-4" /> Patient
              </h2>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={notRegistered}
                  onCheckedChange={(c) => {
                    setNotRegistered(c === true);
                    clearPatient();
                  }}
                />
                Not registered (walk-in)
              </label>
            </div>

            {notRegistered ? (
              <div className="mt-2 space-y-1">
                <Label htmlFor="payer">Received from</Label>
                <Input id="payer" className="h-12 text-base" value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Full name of the person paying" />
              </div>
            ) : patient ? (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-muted/50 p-2.5">
                  <div className="text-sm">
                    <p className="font-bold text-foreground">
                      {patient.firstNames} {patient.surname}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{patient.hospitalNumber}</span> · {patient.age || "Age —"} · {patient.sex || "Sex —"} · {patient.phone || "No phone"}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" className="h-11" onClick={clearPatient}>
                    Change
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payer">Received from</Label>
                  <Input id="payer" className="h-12 text-base" value={payerName} onChange={(e) => setPayerName(e.target.value)} />
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer py-1 font-semibold text-muted-foreground">
                    Payment history {history ? `(${history.length})` : ""}
                  </summary>
                  {history === null ? (
                    <p className="py-1 text-muted-foreground">Loading…</p>
                  ) : history.length === 0 ? (
                    <p className="py-1 text-muted-foreground">No earlier receipts.</p>
                  ) : (
                    <ul className="mt-1 divide-y divide-border rounded-lg border border-border">
                      {history.map((h) => (
                        <li key={h.id} className="flex justify-between gap-2 px-2 py-1.5">
                          <span className="font-mono">Nº {h.receiptNo}</span>
                          <span>{new Date(h.issuedAt).toLocaleDateString("en-GB")}</span>
                          <span className={h.status === "voided" ? "line-through text-muted-foreground" : "font-bold"}>{formatKobo(h.totalKobo)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </div>
            ) : (
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-12 pl-9 text-base"
                  placeholder="Search by name or hospital number"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (e.target.value.trim().length >= 2) setSearching(true);
                    else setResults([]);
                  }}
                  aria-label="Search patients"
                />
                {query.trim().length >= 2 ? (
                  <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                    {searching && results.length === 0 ? (
                      <li className="px-3 py-3 text-sm text-muted-foreground">Searching…</li>
                    ) : results.length === 0 ? (
                      <li className="px-3 py-3 text-sm text-muted-foreground">No patient found. Tick &quot;Not registered&quot; for a walk-in.</li>
                    ) : (
                      results.map((p) => (
                        <li key={p.id}>
                          <button type="button" className="flex min-h-14 w-full flex-col justify-center px-3 py-2 text-left hover:bg-muted" onClick={() => pickPatient(p)}>
                            <span className="text-sm font-semibold text-foreground">
                              {p.firstNames} {p.surname}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              <span className="font-mono">{p.hospitalNumber}</span> · {p.age || "—"} · {p.sex || "—"}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Service tiles */}
            <div className="rounded-xl border border-border bg-card p-3 md:max-h-[calc(100vh-15rem)] md:overflow-y-auto">
              {catalogue.map((cat) => (
                <div key={cat.id} className="mb-3 last:mb-0">
                  <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{cat.name}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.services.map((s) => {
                      const needsPrice = s.priceKobo === 0 && !s.allowCustomAmount;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={needsPrice}
                          onClick={() => addService(s)}
                          className="flex min-h-14 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-left transition-colors hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {s.folderColour ? (
                            <span className={`h-8 w-6 shrink-0 rounded-sm border-2 ${FOLDER_SWATCH[s.folderColour] ?? "bg-muted"}`} aria-label={`${s.folderColour} folder`} />
                          ) : null}
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold leading-tight text-foreground">{s.name}</span>
                            <span className="block font-mono text-[11px] text-muted-foreground">
                              {s.allowCustomAmount ? "Type amount" : needsPrice ? "Needs price" : formatKobo(s.priceKobo)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Basket, total, payment, issue */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <FileText className="h-4 w-4" /> Items
              </h2>
              {lines.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Tap a service to add it.</p>
              ) : (
                <ul className="space-y-2">
                  {lines.map((l) => (
                    <li key={l.key} className="rounded-lg border border-border p-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{l.name}</p>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-rose-600" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} aria-label={`Remove ${l.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {l.unitPriceKobo === null ? (
                        <div className="mt-1 grid grid-cols-5 gap-2">
                          <Input className="col-span-3 h-11" placeholder="What for (e.g. wound dressing)" value={l.description} onChange={(e) => updateLine(l.key, { description: e.target.value })} />
                          <div className="relative col-span-2">
                            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
                            <Input className="h-11 pl-6" inputMode="decimal" placeholder="Amount" value={l.amount} onChange={(e) => updateLine(l.key, { amount: e.target.value })} />
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="outline" size="icon" className="h-10 w-10" disabled={l.qty <= 1} onClick={() => updateLine(l.key, { qty: l.qty - 1 })} aria-label="Decrease quantity">
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-mono font-bold">{l.qty}</span>
                          <Button type="button" variant="outline" size="icon" className="h-10 w-10" disabled={l.qty >= 999} onClick={() => updateLine(l.key, { qty: l.qty + 1 })} aria-label="Increase quantity">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <span className="font-mono text-sm font-bold text-foreground">{formatKobo(lineTotal(l))}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="rounded-lg bg-muted/60 px-3 py-2 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="font-mono text-3xl font-black text-foreground">{formatKobo(total)}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_MODES.map((m) => {
                  const Icon = MODE_ICONS[m];
                  return (
                    <Button
                      key={m}
                      type="button"
                      variant={mode === m ? "default" : "outline"}
                      className="h-14 gap-2 text-base font-bold"
                      onClick={() => setMode(m)}
                      aria-pressed={mode === m}
                    >
                      <Icon className="h-5 w-5" /> {PAYMENT_MODE_LABELS[m]}
                    </Button>
                  );
                })}
              </div>
              {mode === "transfer" || mode === "pos" ? (
                <div className="space-y-1">
                  <Label htmlFor="ref">{mode === "pos" ? "POS reference" : "Teller / transfer reference"}</Label>
                  <Input id="ref" className="h-12" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" />
                </div>
              ) : null}
              {mode === "cheque" ? (
                <div className="space-y-1">
                  <Label htmlFor="cheque">Cheque number (required)</Label>
                  <Input id="cheque" className="h-12" value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} />
                </div>
              ) : null}

              <Button type="button" disabled={!canIssue || busy} onClick={handleIssue} className="h-14 gap-2 bg-brand-green text-lg font-bold text-white hover:bg-emerald-700">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Issue receipt
              </Button>
              {!canIssue && !busy ? (
                <p className="text-center text-xs text-muted-foreground">
                  {!notRegistered && !patient
                    ? "Pick a patient, or tick Not registered."
                    : !payerName.trim()
                      ? "Enter who the money was received from."
                      : !linesValid
                        ? lines.length === 0
                          ? "Add at least one item."
                          : "Enter an amount for every typed item."
                        : !mode
                          ? "Choose a payment mode."
                          : "Enter the cheque number."}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* 3. THIS SHIFT'S RECEIPTS (right) */}
        <aside className="rounded-xl border border-border bg-card p-3 lg:col-span-4 lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-5.5rem)] lg:self-start lg:overflow-y-auto">
          <h2 className="mb-2 text-sm font-bold text-foreground">This shift&apos;s receipts</h2>
          <ReceiptList receipts={receipts} onChanged={refresh} />
        </aside>
      </div>

      <Dialog open={closing} onOpenChange={(open) => !busy && setClosing(open)}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Close your shift</DialogTitle>
            <DialogDescription className="text-sm pt-1">Count the cash in the drawer and type the figure. A closed shift can&apos;t be reopened.</DialogDescription>
          </DialogHeader>
          {!closeSummary ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Working out the totals…
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Receipts issued</p>
                  <p className="font-mono text-lg font-black">{closeSummary.totals.issuedCount}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total taken</p>
                  <p className="font-mono text-lg font-black">{formatKobo(closeSummary.totals.issuedKobo)}</p>
                </div>
              </div>
              <table className="w-full">
                <tbody className="divide-y divide-border">
                  {PAYMENT_MODES.map((m) => (
                    <tr key={m}>
                      <td className="py-1 text-muted-foreground">{PAYMENT_MODE_LABELS[m]}</td>
                      <td className="py-1 text-right text-muted-foreground">{closeSummary.byMode[m].count}</td>
                      <td className="py-1 text-right font-mono font-semibold">{formatKobo(closeSummary.byMode[m].totalKobo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {closeSummary.totals.voidCount > 0 ? (
                <div className={`rounded-lg border p-2.5 ${closeSummary.voidAlert ? "border-rose-400 bg-rose-500/10" : "border-border"}`}>
                  <p className="font-semibold">
                    {closeSummary.totals.voidCount} void{closeSummary.totals.voidCount === 1 ? "" : "s"} ({formatKobo(closeSummary.totals.voidKobo)}), not counted in the totals
                    {closeSummary.voidAlert ? ` · more than ${SHIFT_VOID_ALERT_THRESHOLD}, flagged for management` : ""}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {closeSummary.receipts
                      .filter((x) => x.status === "voided")
                      .map((x) => (
                        <li key={x.receiptNo}>
                          Nº {x.receiptNo} · {formatKobo(x.totalKobo)} · {x.voidReason}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
              <div className="rounded-lg border border-border p-2.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Opening float</span><span className="font-mono">{formatKobo(closeSummary.cash.openingFloatKobo)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">+ Cash receipts (voids excluded)</span><span className="font-mono">{formatKobo(closeSummary.cash.cashTakenKobo)}</span></div>
                <div className="mt-1 flex justify-between border-t border-border pt-1 font-bold"><span>Expected cash in drawer</span><span className="font-mono">{formatKobo(closeSummary.cash.expectedCashKobo)}</span></div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="counted">Cash you counted in the drawer</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
                  <Input id="counted" className="h-14 pl-7 text-lg" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="Count, then type the total" />
                </div>
              </div>
              {variance !== null ? (
                <p className={`rounded-lg px-3 py-2 text-center text-lg font-black ${variance === 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400"}`}>
                  {describeVariance(variance, formatKobo)}
                </p>
              ) : null}
              {variance !== null && variance !== 0 ? (
                <div className="space-y-1">
                  <Label htmlFor="close-note">Explain the difference (required)</Label>
                  <Textarea id="close-note" rows={3} value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="e.g. Gave ₦500 change from my own purse; customer short-paid by ₦1,000" />
                </div>
              ) : null}
            </div>
          )}
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => setClosing(false)}>
              Keep working
            </Button>
            <Button type="button" className="h-11 gap-1.5" disabled={busy || !closeSummary || !canClose} onClick={handleClose}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Close shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
