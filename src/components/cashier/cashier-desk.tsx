"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote, CheckCircle2, Clock, CreditCard, FileText, History, Landmark, Loader2, Minus, Pill, Plus, Printer, Receipt, Search, Shield, ShieldCheck, Smartphone, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
  type CashierDrugItem,
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
  serviceId: string | null;
  name: string;
  /** Fixed catalogue price; null when the amount is typed ("Others", unpriced services, or custom). */
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
  initialShift,
  initialReceipts,
  catalogue,
  drugs = [],
}: {
  initialShift: ShiftSummary | null;
  initialReceipts: ReceiptSummary[];
  catalogue: SaleCategory[];
  drugs?: CashierDrugItem[];
}) {
  const router = useRouter();
  const [shift, setShift] = useState(initialShift);
  const [receipts, setReceipts] = useState(initialReceipts);
  const [busy, setBusy] = useState(false);

  // Catalog tabs & item search
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [itemSearch, setItemSearch] = useState<string>("");
  type InsuranceScheme = "none" | "kachma" | "nhis";
  const [insuranceScheme, setInsuranceScheme] = useState<InsuranceScheme>("none");
  const [receiptsDialogOpen, setReceiptsDialogOpen] = useState(false);

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
  const [cashierName, setCashierName] = useState("");
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

  function handleSchemeChange(newScheme: InsuranceScheme) {
    setInsuranceScheme(newScheme);
    setLines((prev) =>
      prev.map((l) => {
        const matchedDrug = drugs.find((d) => d.name.toLowerCase() === l.name.toLowerCase());
        const isDrug = Boolean(matchedDrug) || l.description.toLowerCase().includes("covered - free");
        if (!isDrug) return l;

        if (newScheme === "none") {
          const originalKobo = matchedDrug ? Math.round(matchedDrug.unitPrice * 100) : (l.unitPriceKobo || 0);
          const originalAmount = matchedDrug ? String(matchedDrug.unitPrice) : l.amount;
          const cleanedDesc = l.description.replace(/\s*\[(KACHMA|NHIS) Covered - Free\]/gi, "").trim();
          return {
            ...l,
            unitPriceKobo: originalKobo,
            amount: originalAmount,
            description: cleanedDesc,
          };
        } else {
          const tag = `[${newScheme.toUpperCase()} Covered - Free]`;
          const baseDesc = l.description.replace(/\s*\[(KACHMA|NHIS) Covered - Free\]/gi, "").trim();
          return {
            ...l,
            unitPriceKobo: 0,
            amount: "0",
            description: baseDesc ? `${baseDesc} ${tag}` : tag,
          };
        }
      })
    );
  }

  function pickPatient(p: CashierPatient) {
    setPatient(p);
    setPayerName(`${p.firstNames} ${p.surname}`.trim());
    setQuery("");
    setResults([]);
    setHistory(null);
    const s = (p.insuranceScheme || "").toLowerCase();
    if (s.includes("kachma")) {
      handleSchemeChange("kachma");
    } else if (s.includes("nhis")) {
      handleSchemeChange("nhis");
    } else {
      handleSchemeChange("none");
    }
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
    handleSchemeChange("none");
  }

  function addService(s: SaleService) {
    if (s.allowCustomAmount || s.priceKobo === 0) {
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

  function addCustomItem(initialName = "Other Payment") {
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        serviceId: null,
        name: initialName,
        unitPriceKobo: null,
        qty: 1,
        description: "",
        amount: "",
      },
    ]);
  }

  function addDrug(d: CashierDrugItem) {
    const isFree = insuranceScheme !== "none";
    const kobo = isFree ? 0 : Math.round(d.unitPrice * 100);
    const amountStr = isFree ? "0" : String(d.unitPrice);
    const baseDesc = [d.strength, d.unit].filter(Boolean).join(" ");
    const tag = isFree ? `[${insuranceScheme.toUpperCase()} Covered - Free]` : "";
    const fullDesc = [baseDesc, tag].filter(Boolean).join(" ").trim();

    setLines((prev) => {
      const existing = prev.find((l) => l.serviceId === null && l.name === d.name && l.unitPriceKobo === kobo);
      if (existing) return prev.map((l) => (l.key === existing.key ? { ...l, qty: Math.min(999, l.qty + 1) } : l));
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          serviceId: null,
          name: d.name,
          unitPriceKobo: kobo,
          qty: 1,
          description: fullDesc,
          amount: amountStr,
        },
      ];
    });
  }

  function updateLine(key: string, patch: Partial<DeskLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const normalizedSearch = itemSearch.trim().toLowerCase();

  const matchingDrugs = useMemo(() => {
    if (!normalizedSearch) return [];
    return drugs.filter((d) => {
      const n = d.name.toLowerCase();
      const s = (d.strength || "").toLowerCase();
      const u = (d.unit || "").toLowerCase();
      return n.includes(normalizedSearch) || s.includes(normalizedSearch) || u.includes(normalizedSearch);
    });
  }, [drugs, normalizedSearch]);

  const matchingCatalogue = useMemo(() => {
    if (!normalizedSearch) return [];
    return catalogue
      .map((cat) => ({
        ...cat,
        services: cat.services.filter((s) => s.name.toLowerCase().includes(normalizedSearch)),
      }))
      .filter((cat) => cat.services.length > 0);
  }, [catalogue, normalizedSearch]);

  const total = useMemo(() => lines.reduce((sum, l) => sum + lineTotal(l), 0), [lines]);
  const linesValid = lines.length > 0 && lines.every((l) => lineTotal(l) >= 0);
  const canIssue =
    Boolean(shift) &&
    payerName.trim().length > 0 &&
    linesValid &&
    (total === 0 || mode !== null) &&
    (mode !== "cheque" || chequeNo.trim().length > 0) &&
    (notRegistered || patient !== null);

  function resetReceipt() {
    setLines([]);
    setMode(null);
    setRef("");
    setChequeNo("");
    clearPatient();
    setNotRegistered(false);
    handleSchemeChange("none");
  }

  async function handleIssue() {
    if (!canIssue) return;
    const finalMode = total === 0 ? (mode ?? "cash") : mode;
    if (!finalMode) return;
    setBusy(true);
    try {
      const response = await fetch("/api/cashier/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        patientId: notRegistered ? null : patient?.id ?? null,
        payerName: payerName.trim(),
        paymentMode: finalMode,
        tellerOrTransferRef: ref.trim() || undefined,
        chequeNo: chequeNo.trim() || undefined,
        lines: lines.map((l) => ({
          serviceId: l.serviceId || null,
          qty: l.qty,
          amount: l.amount ? l.amount : (l.unitPriceKobo !== null ? (l.unitPriceKobo / 100).toFixed(2) : undefined),
          description:
            l.serviceId === null && l.description.trim()
              ? `${l.name} (${l.description.trim()})`
              : l.description.trim() || (l.serviceId === null ? l.name : undefined),
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
      const res = await startShift(cashierName, openingFloat.trim() || "0");
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setShift(res.shift);
      setReceipts(await listShiftReceipts(res.shift.id));
      setCashierName("");
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
          <p className="text-lg font-bold text-foreground">Who&apos;s on shift?</p>
          <p className="mt-1 text-sm text-muted-foreground">Type your name and start a shift to begin issuing receipts. The time is recorded automatically.</p>
        </div>
        <div className="w-full space-y-1 text-left">
          <Label htmlFor="cashier-name">Your name</Label>
          <Input id="cashier-name" className="h-14 text-lg" autoComplete="off" placeholder="e.g. Amaka Obi" value={cashierName} onChange={(e) => setCashierName(e.target.value)} />
        </div>
        <div className="w-full space-y-1 text-left">
          <Label htmlFor="float">Opening float: cash already in the drawer</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
            <Input id="float" className="h-14 pl-7 text-lg" inputMode="decimal" placeholder="0" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} />
          </div>
        </div>
        <Button type="button" onClick={handleStart} disabled={busy || cashierName.trim().length < 2 || (openingFloat.trim() !== "" && parseNairaToKobo(openingFloat) === null)} className="h-16 w-full gap-2 bg-brand-green text-lg font-bold text-white hover:bg-emerald-700">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clock className="h-5 w-5" />} Start shift
        </Button>
        <Link href="/cashier/reports" className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <History className="h-4 w-4" /> Past shift reports
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 1. SHIFT STATS & ACTIONS */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">Active Shift</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold hover:border-brand-green/60 hover:text-brand-green"
              onClick={() => setReceiptsDialogOpen(true)}
            >
              <Receipt className="h-3.5 w-3.5 text-brand-green" /> Shift receipts ({receipts.length})
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
              <Link href="/cashier/reports">
                <History className="h-3.5 w-3.5" /> Past shifts
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs font-semibold hover:border-destructive hover:text-destructive" onClick={openCloseDialog}>
              Close shift
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {/* 1. On shift */}
          <div className="rounded-lg border border-border bg-card p-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">On shift</p>
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <UserRound className="h-3 w-3" />
              </div>
            </div>
            <p className="mt-1 truncate text-xs sm:text-sm font-bold capitalize text-foreground" title={shift.cashierName}>
              {shift.cashierName}
            </p>
          </div>

          {/* 2. Opened */}
          <div className="rounded-lg border border-border bg-card p-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Opened</p>
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="h-3 w-3" />
              </div>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-bold text-foreground">
              {time(shift.openedAt)}
            </p>
          </div>

          {/* 3. Receipts */}
          <div className="rounded-lg border border-border bg-card p-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Receipts</p>
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <FileText className="h-3 w-3" />
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-1">
              <span className="text-xs sm:text-sm font-bold text-foreground">{shift.receiptCount}</span>
              {shift.voidedCount ? (
                <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                  ({shift.voidedCount} void)
                </span>
              ) : null}
            </div>
          </div>

          {/* 4. Total taken */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 shadow-2xs dark:bg-emerald-500/10">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total taken</p>
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                <Banknote className="h-3 w-3" />
              </div>
            </div>
            <p className="mt-1 font-mono text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-400">
              {formatKobo(shift.totalKobo)}
            </p>
          </div>

          {/* 5. Opening float */}
          <div className="rounded-lg border border-border bg-card p-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Opening float</p>
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400">
                <Landmark className="h-3 w-3" />
              </div>
            </div>
            <p className="mt-1 font-mono text-xs sm:text-sm font-bold text-foreground">
              {formatKobo(shift.openingFloatKobo)}
            </p>
          </div>

          {/* 6. Shift receipts (Right end tab) */}
          <button
            type="button"
            onClick={() => setReceiptsDialogOpen(true)}
            className="group rounded-lg border border-border/90 bg-card p-2.5 shadow-2xs text-left transition-all hover:border-brand-green/70 hover:bg-muted/40 hover:shadow-xs active:scale-[0.98]"
            title="Click to view all receipts issued this shift"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-green">
                Shift Receipts
              </p>
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10 text-brand-green">
                <Receipt className="h-3 w-3" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-1">
              <span className="text-xs sm:text-sm font-bold text-foreground">
                {receipts.length} {receipts.length === 1 ? "receipt" : "receipts"}
              </span>
              <span className="text-[10px] font-semibold text-brand-green group-hover:underline">
                View &rarr;
              </span>
            </div>
          </button>
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

      {/* 2. PATIENT & SCHEME CARD (Full width) */}
      <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
            <UserRound className="h-4 w-4 text-brand-green" /> Patient &amp; Insurance Scheme
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-0.5">Scheme:</span>
            <button
              type="button"
              onClick={() => handleSchemeChange("none")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                insuranceScheme === "none"
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-2xs"
                  : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => handleSchemeChange("kachma")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                insuranceScheme === "kachma"
                  ? "bg-amber-500 text-white shadow-2xs font-bold"
                  : "border border-amber-300/80 bg-amber-50/50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300"
              )}
            >
              <Shield className="h-3 w-3" />
              KACHMA (Free Drugs)
            </button>
            <button
              type="button"
              onClick={() => handleSchemeChange("nhis")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                insuranceScheme === "nhis"
                  ? "bg-blue-600 text-white shadow-2xs font-bold"
                  : "border border-blue-300/80 bg-blue-50/50 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300"
              )}
            >
              <Shield className="h-3 w-3" />
              NHIS (Free Drugs)
            </button>

            <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-xs font-medium text-foreground">
              <Checkbox
                checked={notRegistered}
                onCheckedChange={(c) => {
                  setNotRegistered(c === true);
                  clearPatient();
                }}
              />
              Walk-in (Not registered)
            </label>
          </div>
        </div>

        {/* Free Drugs Banner */}
        {insuranceScheme !== "none" ? (
          <div className={cn(
            "mt-2.5 flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-xs font-medium border",
            insuranceScheme === "kachma"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
              : "bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200"
          )}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>{insuranceScheme.toUpperCase()} Insurance Active:</strong> Prescribed drugs and medications are <strong>100% Free (₦0)</strong> for this patient.
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/70 dark:bg-black/40 text-emerald-700 dark:text-emerald-300">
              Drugs Free
            </span>
          </div>
        ) : null}

        {notRegistered ? (
          <div className="mt-2.5 space-y-1">
            <Label htmlFor="payer" className="text-xs">Received from (Walk-in payer)</Label>
            <Input
              id="payer"
              className="h-9.5 text-xs sm:text-sm bg-background"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              placeholder="Full name of the person paying"
            />
          </div>
        ) : patient ? (
          <div className="mt-2.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-2.5">
              <div className="text-xs">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-foreground">
                    {patient.firstNames} {patient.surname}
                  </p>
                  {insuranceScheme !== "none" ? (
                    <span className={cn(
                      "rounded px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider",
                      insuranceScheme === "kachma" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    )}>
                      {insuranceScheme}
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground mt-0.5">
                  <span className="font-mono">{patient.hospitalNumber}</span> · DOB: {patient.dob || "—"} · {patient.sex || "Sex —"} · {patient.phone || "No phone"}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs font-semibold" onClick={clearPatient}>
                Change patient
              </Button>
            </div>
            <div className="space-y-1">
              <Label htmlFor="payer" className="text-xs">Received from</Label>
              <Input id="payer" className="h-9.5 text-xs sm:text-sm bg-background" value={payerName} onChange={(e) => setPayerName(e.target.value)} />
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer py-0.5 font-semibold text-muted-foreground hover:text-foreground">
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
          <div className="relative mt-2.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9.5 pl-8.5 pr-8 text-xs sm:text-sm bg-background placeholder:text-muted-foreground/70"
              placeholder="Search patient by name or hospital number..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim().length >= 2) setSearching(true);
                else setResults([]);
              }}
              aria-label="Search patients"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear patient search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {query.trim().length >= 2 ? (
              <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                {searching && results.length === 0 ? (
                  <li className="px-3 py-3 text-xs text-muted-foreground">Searching…</li>
                ) : results.length === 0 ? (
                  <li className="px-3 py-3 text-xs text-muted-foreground">No patient found. Tick &quot;Walk-in&quot; for an unregistered patient.</li>
                ) : (
                  results.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="flex min-h-12 w-full flex-col justify-center px-3 py-2 text-left hover:bg-muted" onClick={() => pickPatient(p)}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-semibold text-foreground">
                            {p.firstNames} {p.surname}
                          </span>
                          {p.insuranceScheme ? (
                            <span className="rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.2 text-[10px] font-bold uppercase">
                              {p.insuranceScheme}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          <span className="font-mono">{p.hospitalNumber}</span> · DOB: {p.dob || "—"} · {p.sex || "—"}
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

      {/* Two Column Workspace: Left (col-span-7) = Catalogue & Drugs, Right (col-span-5) = Items & Payment */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Service & Drug selection */}
        <div className="flex flex-col rounded-xl border border-border bg-card p-3 lg:col-span-7 md:max-h-[calc(100vh-14rem)] md:overflow-hidden shadow-2xs">
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pay for Services &amp; Drugs</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addCustomItem("Custom Payment")}
                  className="h-8 gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                >
                  <Plus className="h-3.5 w-3.5" /> + Custom Payment
                </Button>
              </div>

              {/* Universal Search across drugs and services */}
              <div className="relative mb-2.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 bg-background pl-9 pr-8 text-xs placeholder:text-muted-foreground"
                  placeholder="Search drugs, folders, scans, consultation, anything..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  aria-label="Search items and drugs"
                />
                {itemSearch ? (
                  <button
                    type="button"
                    onClick={() => setItemSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              {/* Category & Drugs Tabs */}
              <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-border/60">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                    selectedCategory === "all"
                      ? "bg-brand-green text-white shadow-xs"
                      : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  All Items
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("drugs")}
                  className={cn(
                    "flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                    selectedCategory === "drugs"
                      ? "bg-brand-green text-white shadow-xs"
                      : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Pill className="h-3 w-3" />
                  Drugs
                  <span
                    className={cn(
                      "ml-1 rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                      selectedCategory === "drugs" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {drugs.length}
                  </span>
                </button>
                {catalogue.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                      selectedCategory === cat.id
                        ? "bg-brand-green text-white shadow-xs"
                        : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Scrollable Items List */}
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {/* 1. When Search query is typed */}
                {normalizedSearch ? (
                  <>
                    {matchingDrugs.length === 0 && matchingCatalogue.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        <p>No drugs or services found matching &quot;{itemSearch}&quot;.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            addCustomItem(itemSearch);
                            setItemSearch("");
                          }}
                          className="mt-2 text-xs"
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" /> Pay for &quot;{itemSearch}&quot; as custom item
                        </Button>
                      </div>
                    ) : null}

                    {/* Matching Drugs */}
                    {matchingDrugs.length > 0 ? (
                      <div>
                        <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          <Pill className="h-3.5 w-3.5 text-brand-green" /> Drugs ({matchingDrugs.length})
                        </h4>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {matchingDrugs.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => addDrug(d)}
                              className="flex min-h-12 items-center justify-between gap-2 rounded-lg border border-border bg-background p-2 text-left transition-colors hover:border-brand-green/60 hover:bg-muted/60 active:scale-[0.98]"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold leading-tight text-foreground" title={d.name}>
                                  {d.name}
                                </span>
                                {d.strength || d.unit ? (
                                  <span className="block truncate font-mono text-[10px] text-muted-foreground">
                                    {[d.strength, d.unit].filter(Boolean).join(" · ")}
                                  </span>
                                ) : null}
                              </div>
                              {insuranceScheme !== "none" ? (
                                <div className="shrink-0 text-right">
                                  <span className="block font-mono text-[10px] text-muted-foreground line-through">
                                    {formatKobo(d.unitPrice * 100)}
                                  </span>
                                  <span className="inline-flex items-center gap-1 font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                                    ₦0 FREE
                                  </span>
                                </div>
                              ) : (
                                <span className="shrink-0 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                  {formatKobo(d.unitPrice * 100)}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Matching Services */}
                    {matchingCatalogue.map((cat) => (
                      <div key={cat.id}>
                        <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{cat.name}</h4>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {cat.services.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => addService(s)}
                              className="flex min-h-12 items-center gap-2 rounded-lg border border-border bg-background p-2 text-left transition-colors hover:bg-muted active:scale-[0.98]"
                            >
                              {s.folderColour ? (
                                <span className={`h-7 w-5 shrink-0 rounded-sm border-2 ${FOLDER_SWATCH[s.folderColour] ?? "bg-muted"}`} aria-label={`${s.folderColour} folder`} />
                              ) : null}
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold leading-tight text-foreground">{s.name}</span>
                                <span className="block font-mono text-[10px] text-muted-foreground">
                                  {s.allowCustomAmount ? "Type amount" : s.priceKobo === 0 ? "Enter price" : formatKobo(s.priceKobo)}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {/* 2. DRUGS TAB IS SELECTED */}
                    {selectedCategory === "drugs" ? (
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              <Pill className="h-3.5 w-3.5 text-brand-green" /> Hospital Drugs &amp; Medications ({drugs.length})
                            </h4>
                            {insuranceScheme !== "none" ? (
                              <span className="rounded bg-amber-500/15 px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                                Free on {insuranceScheme.toUpperCase()}
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[11px] text-muted-foreground">Tap drug to add</span>
                        </div>
                        {drugs.length === 0 ? (
                          <p className="py-6 text-center text-xs text-muted-foreground">No drugs listed in pharmacy.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {drugs.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => addDrug(d)}
                                className="flex min-h-14 items-center justify-between gap-2 rounded-lg border border-border bg-background p-2.5 text-left transition-all hover:border-brand-green/60 hover:bg-muted/60 active:scale-[0.98]"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <Pill className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    <span className="block truncate text-xs font-semibold leading-tight text-foreground" title={d.name}>
                                      {d.name}
                                    </span>
                                  </div>
                                  {d.strength || d.unit ? (
                                    <span className="block truncate pl-5 text-[11px] text-muted-foreground">
                                      {[d.strength, d.unit].filter(Boolean).join(" · ")}
                                    </span>
                                  ) : null}
                                </div>
                                {insuranceScheme !== "none" ? (
                                  <div className="shrink-0 text-right">
                                    <span className="block font-mono text-[10px] text-muted-foreground line-through">
                                      {formatKobo(d.unitPrice * 100)}
                                    </span>
                                    <span className="inline-flex items-center gap-1 font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                                      ₦0 FREE
                                    </span>
                                  </div>
                                ) : (
                                  <span className="shrink-0 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                    {formatKobo(d.unitPrice * 100)}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* 3. ALL ITEMS TAB */}
                    {selectedCategory === "all" ? (
                      <>
                        {/* Quick Drugs preview under All */}
                        {drugs.length > 0 ? (
                          <div>
                            <div className="mb-1.5 flex items-center justify-between">
                              <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                <Pill className="h-3.5 w-3.5 text-brand-green" /> Drugs ({drugs.length})
                              </h4>
                              <button
                                type="button"
                                onClick={() => setSelectedCategory("drugs")}
                                className="text-[11px] font-semibold text-brand-green hover:underline"
                              >
                                View all {drugs.length} drugs &rarr;
                              </button>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                              {drugs.slice(0, 8).map((d) => (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => addDrug(d)}
                                  className="flex min-h-12 items-center justify-between gap-2 rounded-lg border border-border bg-background p-2 text-left transition-colors hover:border-brand-green/60 hover:bg-muted/60 active:scale-[0.98]"
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-semibold leading-tight text-foreground" title={d.name}>
                                      {d.name}
                                    </span>
                                    {d.strength || d.unit ? (
                                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                                        {[d.strength, d.unit].filter(Boolean).join(" · ")}
                                      </span>
                                    ) : null}
                                  </div>
                                  {insuranceScheme !== "none" ? (
                                    <div className="shrink-0 text-right">
                                      <span className="block font-mono text-[10px] text-muted-foreground line-through">
                                        {formatKobo(d.unitPrice * 100)}
                                      </span>
                                      <span className="inline-flex items-center gap-1 font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                                        ₦0 FREE
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="shrink-0 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                      {formatKobo(d.unitPrice * 100)}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {/* All Catalogue Categories */}
                        {catalogue.map((cat) => (
                          <div key={cat.id}>
                            <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{cat.name}</h4>
                            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                              {cat.services.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => addService(s)}
                                  className="flex min-h-12 items-center gap-2 rounded-lg border border-border bg-background p-2 text-left transition-colors hover:bg-muted active:scale-[0.98]"
                                >
                                  {s.folderColour ? (
                                    <span className={`h-7 w-5 shrink-0 rounded-sm border-2 ${FOLDER_SWATCH[s.folderColour] ?? "bg-muted"}`} aria-label={`${s.folderColour} folder`} />
                                  ) : null}
                                  <div className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-semibold leading-tight text-foreground">{s.name}</span>
                                    <span className="block font-mono text-[10px] text-muted-foreground">
                                      {s.allowCustomAmount ? "Type amount" : s.priceKobo === 0 ? "Enter price" : formatKobo(s.priceKobo)}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </>
                    ) : null}

                    {/* 4. SPECIFIC CATALOGUE CATEGORY TAB IS SELECTED */}
                    {selectedCategory !== "all" && selectedCategory !== "drugs" ? (
                      catalogue
                        .filter((cat) => cat.id === selectedCategory)
                        .map((cat) => (
                          <div key={cat.id}>
                            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{cat.name}</h4>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {cat.services.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => addService(s)}
                                  className="flex min-h-14 items-center gap-2 rounded-lg border border-border bg-background p-2.5 text-left transition-colors hover:bg-muted active:scale-[0.98]"
                                >
                                  {s.folderColour ? (
                                    <span className={`h-8 w-6 shrink-0 rounded-sm border-2 ${FOLDER_SWATCH[s.folderColour] ?? "bg-muted"}`} aria-label={`${s.folderColour} folder`} />
                                  ) : null}
                                  <div className="min-w-0 flex-1">
                                    <span className="block text-xs font-semibold leading-tight text-foreground">{s.name}</span>
                                    <span className="block font-mono text-[11px] text-muted-foreground">
                                      {s.allowCustomAmount ? "Type amount" : s.priceKobo === 0 ? "Enter price" : formatKobo(s.priceKobo)}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                    ) : null}
                  </>
                )}
              </div>
            </div>

            {/* Basket, total, payment, issue */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:col-span-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <FileText className="h-4 w-4" /> Items ({lines.length})
                </h2>
                {lines.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-rose-600"
                    onClick={() => setLines([])}
                  >
                    Clear all
                  </Button>
                )}
              </div>
              {lines.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <p>Tap a service to add it, or add a custom payment.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addCustomItem("Other Payment")}
                    className="mt-2 text-xs"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add custom payment
                  </Button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {lines.map((l) => (
                    <li key={l.key} className="rounded-lg border border-border bg-background/50 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {l.serviceId === null ? (
                            <Input
                              className="h-8 font-semibold text-sm px-2 mb-1"
                              value={l.name}
                              placeholder="Item name (e.g. Medical Report, Drugs)"
                              onChange={(e) => updateLine(l.key, { name: e.target.value })}
                            />
                          ) : (
                            <p className="text-sm font-semibold text-foreground">{l.name}</p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                          aria-label={`Remove ${l.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {l.unitPriceKobo === null ? (
                        <div className="mt-1.5 grid grid-cols-5 gap-2">
                          <Input
                            className="col-span-3 h-11 text-sm"
                            placeholder={
                              l.name.toLowerCase().includes("drug")
                                ? "Specify drugs (e.g. Paracetamol, Amartem)"
                                : l.name.toLowerCase().includes("lab")
                                  ? "Specify test (e.g. PCV, Malaria, MP)"
                                  : l.name.toLowerCase().includes("report")
                                    ? "Specify report (e.g. Police Medical Report)"
                                    : "What is this payment for? (optional)"
                            }
                            value={l.description}
                            onChange={(e) => updateLine(l.key, { description: e.target.value })}
                          />
                          <div className="relative col-span-2">
                            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₦</span>
                            <Input
                              className="h-11 pl-7 text-sm font-semibold"
                              inputMode="decimal"
                              placeholder="Amount"
                              value={l.amount}
                              onChange={(e) => updateLine(l.key, { amount: e.target.value })}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1.5">
                          <Input
                            className="h-9 text-xs text-foreground placeholder:text-muted-foreground/70"
                            placeholder="Add note / specify what for (optional)"
                            value={l.description}
                            onChange={(e) => updateLine(l.key, { description: e.target.value })}
                          />
                        </div>
                      )}

                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            disabled={l.qty <= 1}
                            onClick={() => updateLine(l.key, { qty: l.qty - 1 })}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-mono font-bold text-sm">{l.qty}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            disabled={l.qty >= 999}
                            onClick={() => updateLine(l.key, { qty: l.qty + 1 })}
                            aria-label="Increase quantity"
                          >
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

              {total === 0 && lines.length > 0 && insuranceScheme !== "none" ? (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="h-4 w-4" />
                    100% Covered by {insuranceScheme.toUpperCase()} (₦0)
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    All drugs in this basket are fully covered for this insurance patient. No payment is required.
                  </p>
                </div>
              ) : (
                <>
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
                </>
              )}

              <Button
                type="button"
                disabled={!canIssue || busy}
                onClick={handleIssue}
                className="h-14 gap-2 bg-brand-green text-lg font-bold text-white hover:bg-emerald-700"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}{" "}
                {total === 0 && insuranceScheme !== "none" ? "Issue Insurance Receipt (₦0)" : "Issue receipt"}
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
                        : total > 0 && !mode
                          ? "Choose a payment mode."
                          : "Enter the cheque number."}
                </p>
              ) : null}
            </div>
      </div>

      {/* Shift Receipts Dialog */}
      <Dialog open={receiptsDialogOpen} onOpenChange={setReceiptsDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-brand-green" />
              This Shift&apos;s Receipts
            </DialogTitle>
            <DialogDescription>
              Receipts issued during this active shift ({receipts.length} total)
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <ReceiptList receipts={receipts} onChanged={refresh} />
          </div>
        </DialogContent>
      </Dialog>

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
