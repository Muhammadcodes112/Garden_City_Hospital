"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote, Clock, CreditCard, History, Landmark, Loader2, Lock, Minus, Plus, Printer, Search, Smartphone, StickyNote, Trash2, X } from "lucide-react";
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
  /** Set for pharmacy drugs: the drugs KACHMA and NHIS cover. */
  drugId: string | null;
  name: string;
  /** Fixed price; null when the amount is typed ("Others" or a custom item). */
  unitPriceKobo: number | null;
  qty: number;
  description: string;
  amount: string;
};

type InsuranceScheme = "none" | "kachma" | "nhis";

/** One tappable catalogue entry: a priced service or a pharmacy drug. */
type Tile = {
  key: string;
  name: string;
  sub: string;
  priceKobo: number;
  folderColour: string | null;
  /** Unpriced service: a super admin must set its price before it can be sold. */
  needsPrice: boolean;
  /** "Others": the cashier types the amount. */
  typed: boolean;
  service?: SaleService;
  drug?: CashierDrugItem;
};

const MODE_ICONS: Record<PaymentMode, typeof Banknote> = {
  cash: Banknote,
  transfer: Smartphone,
  pos: CreditCard,
  cheque: Landmark,
};

const SCHEME_LABELS: Record<InsuranceScheme, string> = { none: "Standard", kachma: "KACHMA", nhis: "NHIS" };

const SCHEME_CHIP: Record<InsuranceScheme, { off: string; on: string }> = {
  none: {
    off: "border-border bg-card text-foreground hover:bg-muted",
    on: "border-foreground bg-foreground text-background",
  },
  kachma: {
    off: "border-[var(--scheme-kachma-line)] bg-[var(--scheme-kachma-tint)] text-[var(--scheme-kachma-text)] hover:brightness-95",
    on: "border-[var(--scheme-kachma-solid)] bg-[var(--scheme-kachma-solid)] text-white",
  },
  nhis: {
    off: "border-[var(--scheme-nhis-line)] bg-[var(--scheme-nhis-tint)] text-[var(--scheme-nhis-text)] hover:brightness-95",
    on: "border-[var(--scheme-nhis-solid)] bg-[var(--scheme-nhis-solid)] text-white",
  },
};

/** The desk's common sales, pinned at the top of "All" so each is one tap. */
const MOST_USED: RegExp[] = [/^white folder/i, /^pink folder/i, /^general doctor$/i, /^scan\s*[—-]\s*general doctor/i, /\bgyu\b/i, /^anc\b/i];

const DRUGS_TAB = "drugs";
const ALL_TAB = "all";
const ALL_DRUGS_PREVIEW = 12;

function lineTotal(l: DeskLine): number {
  const unit = l.unitPriceKobo ?? parseNairaToKobo(l.amount) ?? 0;
  return unit * l.qty;
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** "Registration (folders)" → "Registration". */
function shortCategory(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, "");
}

function serviceTile(s: SaleService, category: string): Tile {
  return {
    key: `s:${s.id}`,
    name: s.name,
    sub: s.folderColour ? "Folder" : shortCategory(category),
    priceKobo: s.priceKobo,
    folderColour: s.folderColour,
    needsPrice: !s.allowCustomAmount && s.priceKobo <= 0,
    typed: s.allowCustomAmount,
    service: s,
  };
}

function drugTile(d: CashierDrugItem): Tile {
  return {
    key: `d:${d.id}`,
    name: d.name,
    sub: [d.strength, d.unit].filter(Boolean).join(" · ") || "Drug",
    priceKobo: Math.round(d.unitPrice * 100),
    folderColour: null,
    needsPrice: false,
    typed: false,
    drug: d,
  };
}

function isTyping(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

const noopSubscribe = () => () => {};

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("rounded border border-border bg-muted px-1 font-mono text-[10px] font-semibold leading-4 text-muted-foreground", className)}>
      {children}
    </kbd>
  );
}

/** Compact dismissible amber strip: the stale-shift warning and the "needs a price" message. */
function Notice({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  return (
    <div role="status" className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--notice-line)] bg-[var(--notice-tint)] pl-3 text-sm font-medium text-[var(--notice-text)]">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 py-1.5 leading-snug">{children}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-r-lg hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function BarField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col justify-center border-l border-white/15 px-3", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">{label}</span>
      <span className="truncate text-sm font-bold leading-tight">{children}</span>
    </div>
  );
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

  // Catalogue tabs & item search
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_TAB);
  const [itemSearch, setItemSearch] = useState<string>("");
  const [insuranceScheme, setInsuranceScheme] = useState<InsuranceScheme>("none");
  const [receiptsDialogOpen, setReceiptsDialogOpen] = useState(false);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);
  const [staleDismissed, setStaleDismissed] = useState(false);

  // Patient / payer
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CashierPatient[]>([]);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState<CashierPatient | null>(null);
  const [history, setHistory] = useState<ReceiptSummary[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [notRegistered, setNotRegistered] = useState(false);
  const [payerName, setPayerName] = useState("");

  // Sale
  const [lines, setLines] = useState<DeskLine[]>([]);
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<PaymentMode | null>(null);
  const [ref, setRef] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [issued, setIssued] = useState<{ id: string; receiptNo: string; payer: string; totalKobo: number } | null>(null);
  const [issuedHtml, setIssuedHtml] = useState<string | null>(null);

  // Shift start / close
  const [cashierName, setCashierName] = useState("");
  const [openingFloat, setOpeningFloat] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeSummary, setCloseSummary] = useState<ShiftReportSnapshot | null>(null);
  const [counted, setCounted] = useState("");
  const [closeNote, setCloseNote] = useState("");

  const itemSearchRef = useRef<HTMLInputElement>(null);
  const patientSearchRef = useRef<HTMLInputElement>(null);
  const patientClearRef = useRef<HTMLButtonElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const payerInputRef = useRef<HTMLInputElement>(null);
  const printButtonRef = useRef<HTMLButtonElement>(null);

  // The layout's top bar has a slot for the shift fields (src/app/(cashier)/layout.tsx).
  const barSlot = useSyncExternalStore(
    noopSubscribe,
    () => document.getElementById("cashier-bar"),
    () => null,
  );

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
    setShowHistory(false);
    const s = (p.insuranceScheme || "").toLowerCase();
    setInsuranceScheme(s.includes("kachma") ? "kachma" : s.includes("nhis") ? "nhis" : "none");
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
    setShowHistory(false);
    setPayerName("");
    setInsuranceScheme("none");
  }

  function addService(s: SaleService) {
    if (!s.allowCustomAmount && s.priceKobo <= 0) {
      setPriceNotice(`${s.name} has no price yet. A super admin must set it on the price list before it can be charged.`);
      return;
    }
    setPriceNotice(null);
    if (s.allowCustomAmount) {
      setLines((prev) => [
        ...prev,
        { key: crypto.randomUUID(), serviceId: s.id, drugId: null, name: s.name, unitPriceKobo: null, qty: 1, description: "", amount: "" },
      ]);
      return;
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.serviceId === s.id && l.unitPriceKobo !== null);
      if (existing) return prev.map((l) => (l.key === existing.key ? { ...l, qty: Math.min(999, l.qty + 1) } : l));
      return [...prev, { key: crypto.randomUUID(), serviceId: s.id, drugId: null, name: s.name, unitPriceKobo: s.priceKobo, qty: 1, description: "", amount: "" }];
    });
  }

  function addCustomItem(initialName = "Other Payment") {
    setLines((prev) => [
      ...prev,
      { key: crypto.randomUUID(), serviceId: null, drugId: null, name: initialName, unitPriceKobo: null, qty: 1, description: "", amount: "" },
    ]);
  }

  function addDrug(d: CashierDrugItem) {
    setPriceNotice(null);
    setLines((prev) => {
      const existing = prev.find((l) => l.drugId === d.id);
      if (existing) return prev.map((l) => (l.key === existing.key ? { ...l, qty: Math.min(999, l.qty + 1) } : l));
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          serviceId: null,
          drugId: d.id,
          name: d.name,
          unitPriceKobo: Math.round(d.unitPrice * 100),
          qty: 1,
          description: [d.strength, d.unit].filter(Boolean).join(" "),
          amount: String(d.unitPrice),
        },
      ];
    });
  }

  function addTile(t: Tile) {
    if (t.service) addService(t.service);
    else if (t.drug) addDrug(t.drug);
  }

  function updateLine(key: string, patch: Partial<DeskLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  /** On KACHMA or NHIS, pharmacy drugs are free; every other service is still charged. */
  const isCovered = (l: DeskLine) => insuranceScheme !== "none" && l.drugId !== null;

  // --- Catalogue -------------------------------------------------------------
  const normalizedSearch = itemSearch.trim().toLowerCase();

  const serviceTilesByCategory = useMemo(
    () => catalogue.map((cat) => ({ id: cat.id, name: cat.name, tiles: cat.services.map((s) => serviceTile(s, cat.name)) })),
    [catalogue],
  );
  const drugTiles = useMemo(() => drugs.map(drugTile), [drugs]);

  const mostUsed = useMemo(() => {
    const all = serviceTilesByCategory.flatMap((c) => c.tiles);
    return MOST_USED.map((re) => all.find((t) => re.test(t.name))).filter((t): t is Tile => Boolean(t));
  }, [serviceTilesByCategory]);

  // Tabs in desk order: the catalogue's categories with Drugs placed before "Other".
  const tabs = useMemo(() => {
    const cats = serviceTilesByCategory.map((c) => ({ id: c.id, label: shortCategory(c.name), count: c.tiles.length }));
    const drugTab = { id: DRUGS_TAB, label: "Drugs", count: drugTiles.length };
    const otherIdx = cats.findIndex((c) => /^other/i.test(c.label));
    if (otherIdx === -1) cats.push(drugTab);
    else cats.splice(otherIdx, 0, drugTab);
    return [{ id: ALL_TAB, label: "All", count: cats.reduce((n, c) => n + c.count, 0) }, ...cats];
  }, [serviceTilesByCategory, drugTiles]);

  const groups = useMemo((): { title: string; tiles: Tile[]; more?: number }[] => {
    if (normalizedSearch) {
      const matches = (t: Tile) => t.name.toLowerCase().includes(normalizedSearch) || t.sub.toLowerCase().includes(normalizedSearch);
      return [
        ...serviceTilesByCategory.map((c) => ({ title: shortCategory(c.name), tiles: c.tiles.filter(matches) })),
        { title: "Drugs", tiles: drugTiles.filter(matches) },
      ].filter((g) => g.tiles.length > 0);
    }
    if (selectedCategory === DRUGS_TAB) return [{ title: "Drugs", tiles: drugTiles }];
    if (selectedCategory === ALL_TAB) {
      return [
        ...(mostUsed.length ? [{ title: "Most used", tiles: mostUsed }] : []),
        ...serviceTilesByCategory.map((c) => ({ title: shortCategory(c.name), tiles: c.tiles })),
        ...(drugTiles.length
          ? [{ title: "Drugs", tiles: drugTiles.slice(0, ALL_DRUGS_PREVIEW), more: Math.max(0, drugTiles.length - ALL_DRUGS_PREVIEW) }]
          : []),
      ].filter((g) => g.tiles.length > 0);
    }
    return serviceTilesByCategory.filter((c) => c.id === selectedCategory).map((c) => ({ title: shortCategory(c.name), tiles: c.tiles }));
  }, [normalizedSearch, selectedCategory, serviceTilesByCategory, drugTiles, mostUsed]);

  const firstMatch = normalizedSearch ? groups[0]?.tiles[0] : undefined;

  /** How many of each catalogue entry are already in the sale, for the tile badges. */
  const inSale = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) {
      const key = l.drugId ? `d:${l.drugId}` : l.serviceId ? `s:${l.serviceId}` : null;
      if (key) m.set(key, (m.get(key) ?? 0) + l.qty);
    }
    return m;
  }, [lines]);

  // --- Totals ----------------------------------------------------------------
  const chargedLines = lines.filter((l) => !isCovered(l));
  const total = chargedLines.reduce((sum, l) => sum + lineTotal(l), 0);
  const coveredKobo = lines.filter(isCovered).reduce((sum, l) => sum + lineTotal(l), 0);
  const chargedQty = chargedLines.reduce((n, l) => n + l.qty, 0);
  // A typed line must carry a real amount: a ₦0 line never reaches a printed receipt.
  const linesValid = lines.length > 0 && lines.every((l) => l.unitPriceKobo !== null || (parseNairaToKobo(l.amount) ?? 0) > 0);
  const canIssue =
    Boolean(shift) &&
    payerName.trim().length > 0 &&
    linesValid &&
    (total === 0 || mode !== null) &&
    (mode !== "cheque" || chequeNo.trim().length > 0) &&
    (notRegistered || patient !== null);

  function resetReceipt() {
    setLines([]);
    setNoteOpen({});
    setMode(null);
    setRef("");
    setChequeNo("");
    clearPatient();
    setNotRegistered(false);
    setPriceNotice(null);
  }

  function choosePaymentMode(m: PaymentMode) {
    setMode(m);
    if (m !== "cash") requestAnimationFrame(() => refInputRef.current?.focus());
  }

  async function handleIssue() {
    if (!canIssue || busy) return;
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
          lines: lines.map((l) => {
            // Covered drugs go on the receipt at ₦0, tagged with the scheme.
            const covered = isCovered(l);
            const description = covered
              ? [l.description.trim(), `[${insuranceScheme.toUpperCase()} Covered - Free]`].filter(Boolean).join(" ")
              : l.description.trim();
            return {
              serviceId: l.serviceId || null,
              qty: l.qty,
              amount: covered ? "0" : l.amount ? l.amount : l.unitPriceKobo !== null ? (l.unitPriceKobo / 100).toFixed(2) : undefined,
              description: l.serviceId === null && description ? `${l.name} (${description})` : description || (l.serviceId === null ? l.name : undefined),
            };
          }),
        }),
      });
      const res = (await response.json().catch(() => ({}))) as { receiptId?: string; receiptNo?: string; error?: string };
      if (!response.ok || !res.receiptId || !res.receiptNo) {
        toast.error(res.error ?? "Could not issue the receipt");
        return;
      }
      const receiptId = res.receiptId;
      setIssued({ id: receiptId, receiptNo: res.receiptNo, payer: payerName.trim(), totalKobo: total });
      setIssuedHtml(null);
      resetReceipt();
      // The receipt exactly as it prints (side-effect free: no print is recorded).
      fetch(`/api/cashier/receipts/${receiptId}/pdf?html=1`)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then(setIssuedHtml)
        .catch((err) => console.error("Receipt preview failed:", err));
      // The receipt is already issued: a failed refresh must not read as a failed sale.
      refresh().catch((err) => console.error("Refresh after issue failed:", err));
    } catch (err) {
      console.error("Issue failed:", err);
      toast.error("Could not issue the receipt. Nothing was charged; try again.");
    } finally {
      setBusy(false);
    }
  }

  function closeIssued() {
    setIssued(null);
    setIssuedHtml(null);
    resetReceipt();
  }

  // --- Keyboard --------------------------------------------------------------
  // Re-bound every render so the handler always sees the current sale.
  useEffect(() => {
    if (!shift) return;
    function onKey(e: KeyboardEvent) {
      // Open dialogs (receipt, close shift, shift receipts) own their keys; Radix closes them on Esc.
      if (issued || closing || receiptsDialogOpen) return;
      const el = document.activeElement;
      const typing = isTyping(el);
      if (e.key === "F9") {
        e.preventDefault();
        void handleIssue();
        return;
      }
      if (e.key === "Escape") {
        if (typing) el.blur();
        else resetReceipt();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        itemSearchRef.current?.focus();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        (patientSearchRef.current ?? patientClearRef.current)?.focus();
      } else if (e.key >= "1" && e.key <= "4") {
        e.preventDefault();
        choosePaymentMode(PAYMENT_MODES[Number(e.key) - 1]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
        <Link href="/cashier/reports" className="flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <History className="h-4 w-4" /> Past shift reports
        </Link>
      </div>
    );
  }

  const barButton =
    "flex h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-md border border-white/20 px-3 text-xs font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

  const topBar = (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="flex min-w-0 items-center">
        <BarField label="On shift" className="hidden min-[1080px]:flex">
          <span className="flex items-center gap-1.5 capitalize" title={shift.cashierName}>
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {shift.cashierName}
          </span>
        </BarField>
        <BarField label="Open since" className="hidden lg:flex">
          {time(shift.openedAt)}
        </BarField>
        <button
          type="button"
          onClick={() => setReceiptsDialogOpen(true)}
          className="flex h-[44px] min-w-0 flex-col justify-center border-l border-white/15 px-3 text-left hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          title="View, re-print or void this shift's receipts"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Receipts</span>
          <span className="text-sm font-bold leading-tight underline decoration-white/30 underline-offset-2">
            {shift.receiptCount}
            {shift.voidedCount ? <span className="ml-1 text-[11px] font-semibold text-white/70">· {shift.voidedCount} void</span> : null}
          </span>
        </button>
        <BarField label="Taken">
          <span className="font-mono text-base">{formatKobo(shift.totalKobo)}</span>
        </BarField>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Link href="/cashier/reports" className={barButton} aria-label="Past shifts">
          <History className="h-4 w-4" /> <span className="hidden lg:inline">Past shifts</span>
        </Link>
        <button type="button" className={barButton} onClick={openCloseDialog} aria-label="Close shift">
          <Lock className="h-4 w-4" /> <span className="hidden sm:inline">Close shift</span>
        </button>
      </div>
    </div>
  );

  const payerLabel = payerName.trim() || (notRegistered ? "Walk-in" : "No patient yet");
  const refLabel = mode === "cheque" ? "Cheque number" : mode === "pos" ? "POS reference" : "Teller / transfer ref";

  const issueBlocker = !notRegistered && !patient
    ? "Pick a patient (P), or tick Walk-in."
    : !payerName.trim()
      ? "Enter who the money was received from."
      : !linesValid
        ? "Enter an amount for every typed item."
        : total > 0 && !mode
          ? "Choose a payment mode (1–4)."
          : "Enter the cheque number.";

  return (
    <>
      {barSlot ? createPortal(topBar, barSlot) : null}

      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] gap-2 sm:gap-3 min-[1080px]:grid-cols-[minmax(0,1fr)_400px] min-[1080px]:grid-rows-[minmax(0,1fr)]">
        {/* CATALOGUE */}
        <section aria-label="Services and drugs" className="flex min-h-0 flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-2xs min-[760px]:p-3">
          {shift.stale && !staleDismissed ? (
            <Notice onDismiss={() => setStaleDismissed(true)}>
              This shift has been open over {STALE_SHIFT_HOURS} hours and has been flagged to management. Close it if your shift has ended.
            </Notice>
          ) : null}
          {priceNotice ? <Notice onDismiss={() => setPriceNotice(null)}>{priceNotice}</Notice> : null}

          {/* Context row: patient + scheme */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              {patient ? (
                <div className="flex h-[44px] items-center gap-2 rounded-lg border border-[var(--patient-line)] bg-[var(--patient-tint)] pl-3 text-[var(--patient-text)]">
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-bold">
                      {patient.firstNames} {patient.surname}
                    </p>
                    <p className="truncate text-[11px] font-medium">
                      <span className="font-mono">{patient.hospitalNumber}</span>
                      {patient.dob ? ` · DOB ${patient.dob}` : ""}
                      {patient.sex ? ` · ${patient.sex}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHistory((v) => !v)}
                    aria-expanded={showHistory}
                    className="h-[44px] shrink-0 px-2 text-xs font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    History{history ? ` (${history.length})` : ""}
                  </button>
                  <button
                    ref={patientClearRef}
                    type="button"
                    onClick={() => {
                      clearPatient();
                      requestAnimationFrame(() => patientSearchRef.current?.focus());
                    }}
                    className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-r-lg hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Clear patient"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : notRegistered ? (
                <div className="flex h-[44px] items-center gap-2 rounded-lg border border-border bg-muted pl-3 text-sm font-semibold text-foreground">
                  <span className="flex-1 truncate">Walk-in (not registered)</span>
                  <button
                    ref={patientClearRef}
                    type="button"
                    onClick={() => {
                      setNotRegistered(false);
                      clearPatient();
                      requestAnimationFrame(() => patientSearchRef.current?.focus());
                    }}
                    className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-r-lg hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Cancel walk-in"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={patientSearchRef}
                    className="h-[44px] bg-background pl-9 pr-10 text-sm"
                    placeholder="Patient name or hospital number"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (e.target.value.trim().length >= 2) setSearching(true);
                      else setResults([]);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && results[0]) {
                        e.preventDefault();
                        pickPatient(results[0]);
                        itemSearchRef.current?.focus();
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        document.querySelector<HTMLButtonElement>("[data-patient-result]")?.focus();
                      } else if (e.key === "Escape") {
                        setQuery("");
                        setResults([]);
                      }
                    }}
                    aria-label="Search patients"
                    autoComplete="off"
                  />
                  <Kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 max-[759px]:hidden">P</Kbd>
                  {query.trim().length >= 2 ? (
                    <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                      {searching && results.length === 0 ? (
                        <li className="px-3 py-3 text-xs text-muted-foreground">Searching…</li>
                      ) : results.length === 0 ? (
                        <li className="px-3 py-3 text-xs text-muted-foreground">No patient found. Tick &quot;Walk-in&quot; for an unregistered patient.</li>
                      ) : (
                        results.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              data-patient-result
                              className="flex min-h-[48px] w-full flex-col justify-center px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                              onClick={() => {
                                pickPatient(p);
                                itemSearchRef.current?.focus();
                              }}
                              onKeyDown={(e) => {
                                const li = e.currentTarget.parentElement;
                                const sib = e.key === "ArrowDown" ? li?.nextElementSibling : e.key === "ArrowUp" ? li?.previousElementSibling : null;
                                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                                  e.preventDefault();
                                  (sib?.querySelector("button") ?? (e.key === "ArrowUp" ? patientSearchRef.current : null))?.focus();
                                }
                              }}
                            >
                              <span className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                  {p.firstNames} {p.surname}
                                </span>
                                {p.insuranceScheme ? (
                                  <span className="rounded border border-[var(--scheme-kachma-line)] bg-[var(--scheme-kachma-tint)] px-1.5 text-[10px] font-bold uppercase text-[var(--scheme-kachma-text)]">
                                    {p.insuranceScheme}
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                <span className="font-mono">{p.hospitalNumber}</span> · DOB: {p.dob || "—"} · {p.sex || "—"}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                </>
              )}
              {patient && showHistory ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover p-2 text-xs shadow-lg">
                  {history === null ? (
                    <p className="py-1 text-muted-foreground">Loading…</p>
                  ) : history.length === 0 ? (
                    <p className="py-1 text-muted-foreground">No earlier receipts.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {history.map((h) => (
                        <li key={h.id} className="flex justify-between gap-2 px-1 py-1.5">
                          <span className="font-mono">Nº {h.receiptNo}</span>
                          <span>{new Date(h.issuedAt).toLocaleDateString("en-GB")}</span>
                          <span className={h.status === "voided" ? "line-through text-muted-foreground" : "font-bold"}>{formatKobo(h.totalKobo)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            {!patient && !notRegistered ? (
              <label className="flex h-[44px] cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium text-foreground hover:bg-muted">
                <Checkbox
                  checked={notRegistered}
                  onCheckedChange={(c) => {
                    setNotRegistered(c === true);
                    clearPatient();
                    // The checkbox unmounts once ticked; carry focus on to the payer's name.
                    if (c === true) requestAnimationFrame(() => payerInputRef.current?.focus());
                  }}
                />
                Walk-in
              </label>
            ) : null}

            <div role="group" aria-label="Payment scheme" className="flex gap-1.5">
              {(Object.keys(SCHEME_LABELS) as InsuranceScheme[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={insuranceScheme === s}
                  onClick={() => setInsuranceScheme(s)}
                  title={s === "none" ? "Everything charged" : `${SCHEME_LABELS[s]}: drugs covered, services charged`}
                  className={cn(
                    "h-[44px] rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    insuranceScheme === s ? SCHEME_CHIP[s].on : SCHEME_CHIP[s].off,
                  )}
                >
                  {SCHEME_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Category tabs */}
          <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 py-0.5 scrollbar-none">
            {tabs.map((t) => {
              const active = !normalizedSearch && selectedCategory === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedCategory(t.id);
                    setItemSearch("");
                  }}
                  className={cn(
                    "flex h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-brand-green bg-brand-green text-white" : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {t.label}
                  <span className={cn("rounded-full px-1.5 font-mono text-[11px]", active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>{t.count}</span>
                </button>
              );
            })}
          </div>

          {/* Item search */}
          <div className="flex shrink-0 gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={itemSearchRef}
                className="h-[44px] bg-background pl-9 pr-16 text-sm"
                placeholder="Search services and drugs — Enter adds the first match"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && firstMatch) {
                    e.preventDefault();
                    addTile(firstMatch);
                    setItemSearch("");
                  }
                }}
                aria-label="Search services and drugs"
                autoComplete="off"
              />
              {itemSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setItemSearch("");
                    itemSearchRef.current?.focus();
                  }}
                  className="absolute right-1 top-1/2 flex h-[44px] w-[44px] -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <Kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 max-[759px]:hidden">/</Kbd>
              )}
            </div>
            <Button type="button" variant="outline" className="h-[44px] gap-1 px-3 text-sm font-semibold" onClick={() => addCustomItem("Custom Payment")}>
              <Plus className="h-4 w-4" /> Custom
            </Button>
          </div>

          {/* Tiles: the only thing on the page that scrolls */}
          <div className="-mr-1 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {groups.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p>Nothing matches &quot;{itemSearch}&quot;.</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-[44px]"
                  onClick={() => {
                    addCustomItem(itemSearch.trim());
                    setItemSearch("");
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" /> Charge &quot;{itemSearch.trim()}&quot; as a custom item
                </Button>
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.title}>
                  <h3 className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {g.title}
                    {g.more ? (
                      <button
                        type="button"
                        onClick={() => setSelectedCategory(DRUGS_TAB)}
                        className="-my-3 flex h-[44px] items-center rounded px-2 normal-case tracking-normal text-brand-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-emerald-400"
                      >
                        All {drugTiles.length} drugs &rarr;
                      </button>
                    ) : null}
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(178px,1fr))] gap-2">
                    {g.tiles.map((t) => {
                      const count = inSale.get(t.key);
                      const covered = Boolean(t.drug) && insuranceScheme !== "none";
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => addTile(t)}
                          aria-label={`${t.name}, ${t.needsPrice ? "price not set" : t.typed ? "type amount" : covered ? "covered" : formatKobo(t.priceKobo)}${count ? `, ${count} in sale` : ""}`}
                          className={cn(
                            "relative flex min-h-[72px] flex-col justify-between gap-1.5 rounded-lg border bg-background p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]",
                            count ? "border-brand-green/60" : "border-border hover:border-brand-green/60",
                            t.needsPrice ? "bg-muted/60" : "hover:bg-muted/50",
                          )}
                        >
                          <span className={cn("line-clamp-2 text-[13px] font-semibold leading-tight text-foreground", count ? "pr-7" : "")}>{t.name}</span>
                          <span className="flex items-end justify-between gap-2 text-xs">
                            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                              {t.folderColour ? (
                                <span className={cn("h-[13px] w-[13px] shrink-0 rounded-[3px] border", FOLDER_SWATCH[t.folderColour] ?? "bg-muted")} aria-hidden />
                              ) : null}
                              <span className="truncate">{t.sub}</span>
                            </span>
                            {t.needsPrice ? (
                              <span className="shrink-0 font-semibold text-[var(--scheme-kachma-text)]">Set price</span>
                            ) : t.typed ? (
                              <span className="shrink-0 font-semibold text-muted-foreground">Type amount</span>
                            ) : covered ? (
                              <span className="shrink-0 font-semibold text-[var(--covered-text)]">Covered</span>
                            ) : (
                              <span className="shrink-0 font-mono font-bold text-foreground">{formatKobo(t.priceKobo)}</span>
                            )}
                          </span>
                          {count ? (
                            <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-green px-1 font-mono text-[11px] font-bold text-white" aria-hidden>
                              {count}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* SALE */}
        <aside
          aria-label="This sale"
          className="flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-2xs max-[1079px]:max-h-[46vh] max-[1079px]:overflow-y-auto"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border py-1 pl-3 pr-1 min-[760px]:pl-4">
            <h2 className="text-sm font-bold text-foreground">This sale</h2>
            <span className="ml-auto truncate text-sm font-semibold text-muted-foreground" title={payerLabel}>
              {payerLabel}
            </span>
            {lines.length > 0 ? (
              <button
                type="button"
                onClick={resetReceipt}
                className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Clear sale (Esc)"
                title="Clear sale (Esc)"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <span className="h-[44px]" aria-hidden />
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 min-[760px]:px-4 max-[1079px]:min-h-24">
            {lines.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Tap a service, or press / to search.</p>
            ) : (
              <ul className="divide-y divide-border">
                {lines.map((l) => {
                  const covered = isCovered(l);
                  const typed = l.unitPriceKobo === null;
                  const freeItem = l.serviceId === null && l.drugId === null;
                  const showNote = typed || noteOpen[l.key];
                  return (
                    <li key={l.key} className="py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {freeItem ? (
                            <Input
                              className="h-[44px] px-2 text-sm font-semibold"
                              value={l.name}
                              placeholder="Item name (e.g. Medical Report)"
                              onChange={(e) => updateLine(l.key, { name: e.target.value })}
                              aria-label="Item name"
                            />
                          ) : (
                            <p className="text-sm font-semibold leading-tight text-foreground">
                              {l.name}
                              {l.drugId && l.description ? <span className="ml-1 text-xs font-normal text-muted-foreground">{l.description}</span> : null}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 pt-0.5 font-mono text-sm font-bold text-foreground">
                          {covered ? <span className="font-sans font-semibold text-[var(--covered-text)]">Covered</span> : formatKobo(lineTotal(l))}
                        </span>
                      </div>

                      {showNote ? (
                        <div className="mt-1.5 flex gap-2">
                          <Input
                            className="h-[44px] min-w-0 flex-1 text-sm"
                            placeholder={typed ? "What is this payment for?" : "Note on the receipt (optional)"}
                            value={l.description}
                            onChange={(e) => updateLine(l.key, { description: e.target.value })}
                            aria-label={`Note for ${l.name}`}
                          />
                          {typed ? (
                            <div className="relative w-28 shrink-0">
                              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground">₦</span>
                              <Input
                                className="h-[44px] pl-6 text-sm font-semibold"
                                inputMode="decimal"
                                placeholder="Amount"
                                value={l.amount}
                                onChange={(e) => updateLine(l.key, { amount: e.target.value })}
                                aria-label={`Amount for ${l.name}`}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-1 flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-[44px] w-[44px]"
                          disabled={l.qty <= 1}
                          onClick={() => updateLine(l.key, { qty: l.qty - 1 })}
                          aria-label={`Decrease quantity of ${l.name}`}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-mono text-sm font-bold" aria-label="Quantity">
                          {l.qty}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-[44px] w-[44px]"
                          disabled={l.qty >= 999}
                          onClick={() => updateLine(l.key, { qty: l.qty + 1 })}
                          aria-label={`Increase quantity of ${l.name}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        {!typed ? (
                          <span className="ml-1 truncate font-mono text-xs text-muted-foreground">@ {formatKobo(l.unitPriceKobo ?? 0)}</span>
                        ) : null}
                        <span className="flex-1" />
                        {!typed ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-[44px] w-[44px] text-muted-foreground"
                            aria-pressed={Boolean(noteOpen[l.key])}
                            onClick={() => setNoteOpen((prev) => ({ ...prev, [l.key]: !prev[l.key] }))}
                            aria-label={`Note for ${l.name}`}
                            title="Add a note"
                          >
                            <StickyNote className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-[44px] px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
                          onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                          aria-label={`Remove ${l.name}`}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="shrink-0 space-y-2 border-t border-border p-3 min-[760px]:px-4">
            {patient || notRegistered ? (
              <label className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs font-semibold text-muted-foreground">Received from</span>
                <Input
                  ref={payerInputRef}
                  className="h-[44px] text-sm"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  placeholder={notRegistered ? "Full name of the person paying" : undefined}
                />
              </label>
            ) : null}

            <div className="space-y-0.5">
              {coveredKobo > 0 ? (
                <div className="flex justify-between text-sm text-[var(--covered-text)]">
                  <span className="font-semibold">Covered by {SCHEME_LABELS[insuranceScheme]}</span>
                  <span className="font-mono font-semibold">{formatKobo(coveredKobo)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>
                  {chargedQty} {chargedQty === 1 ? "item" : "items"}
                </span>
                <span className="font-mono">{formatKobo(total)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-foreground">To pay</span>
                <span className="font-mono text-[32px] font-black leading-none text-foreground" aria-live="polite">
                  {formatKobo(total)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Payment mode">
              {PAYMENT_MODES.map((m, i) => {
                const Icon = MODE_ICONS[m];
                return (
                  <Button
                    key={m}
                    type="button"
                    variant={mode === m ? "default" : "outline"}
                    className="relative h-[48px] flex-col gap-0 px-1 text-sm font-bold"
                    onClick={() => choosePaymentMode(m)}
                    aria-pressed={mode === m}
                    aria-keyshortcuts={String(i + 1)}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {PAYMENT_MODE_LABELS[m]}
                    <span className={cn("absolute right-1 top-0.5 font-mono text-[10px] font-semibold", mode === m ? "text-white/80" : "text-muted-foreground")} aria-hidden>
                      {i + 1}
                    </span>
                  </Button>
                );
              })}
            </div>
            {total === 0 && coveredKobo > 0 && chargedLines.length === 0 ? (
              <p className="text-xs font-medium text-[var(--covered-text)]">Fully covered by {SCHEME_LABELS[insuranceScheme]}: no payment needed.</p>
            ) : null}

            {mode && mode !== "cash" ? (
              <label className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs font-semibold text-muted-foreground">{refLabel}</span>
                <Input
                  ref={refInputRef}
                  className="h-[44px] text-sm"
                  value={mode === "cheque" ? chequeNo : ref}
                  onChange={(e) => (mode === "cheque" ? setChequeNo(e.target.value) : setRef(e.target.value))}
                  placeholder={mode === "cheque" ? "Required" : "Optional"}
                />
              </label>
            ) : null}

            <Button
              type="button"
              disabled={!canIssue || busy}
              onClick={handleIssue}
              aria-keyshortcuts="F9"
              className="relative h-[54px] w-full gap-2 bg-brand-green text-lg font-bold text-white hover:bg-emerald-700"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />} Issue receipt
              <span className="absolute right-3 font-mono text-[11px] font-semibold text-white/80 max-[759px]:hidden" aria-hidden>
                F9
              </span>
            </Button>
            {lines.length > 0 && !canIssue && !busy ? <p className="text-center text-xs text-muted-foreground">{issueBlocker}</p> : null}
            <p className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground max-[759px]:hidden">
              <span><Kbd>/</Kbd> search</span>
              <span><Kbd>P</Kbd> patient</span>
              <span><Kbd>1–4</Kbd> payment</span>
              <span><Kbd>F9</Kbd> issue</span>
              <span><Kbd>Esc</Kbd> clear</span>
            </p>
          </div>
        </aside>
      </div>

      {/* Receipt confirmation: the receipt exactly as it will print */}
      <Dialog open={Boolean(issued)} onOpenChange={(open) => !open && closeIssued()}>
        <DialogContent
          className="max-h-[96dvh] max-w-[880px] gap-3 overflow-y-auto p-4"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            printButtonRef.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            itemSearchRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Receipt Nº {issued?.receiptNo} issued</DialogTitle>
            <DialogDescription>
              {issued ? `${issued.payer} · ${formatKobo(issued.totalKobo)}. ` : ""}Check it, then print. Closing starts the next sale.
            </DialogDescription>
          </DialogHeader>
          {issuedHtml ? (
            <iframe title={`Receipt Nº ${issued?.receiptNo}`} srcDoc={issuedHtml} sandbox="" className="aspect-[210/148] w-full rounded-md border border-border bg-white" />
          ) : (
            <div className="flex aspect-[210/148] w-full items-center justify-center gap-2 rounded-md border border-border text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading the receipt…
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="h-[44px]" onClick={closeIssued}>
              Close <Kbd className="ml-1.5">Esc</Kbd>
            </Button>
            <Button
              ref={printButtonRef}
              type="button"
              className="h-[44px] gap-1.5"
              onClick={() => issued && printReceipt(issued.id).then(refresh)}
            >
              <Printer className="h-4 w-4" /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Receipts Dialog */}
      <Dialog open={receiptsDialogOpen} onOpenChange={setReceiptsDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>This shift&apos;s receipts</DialogTitle>
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
            <Button type="button" variant="outline" className="h-[44px]" disabled={busy} onClick={() => setClosing(false)}>
              Keep working
            </Button>
            <Button type="button" className="h-[44px] gap-1.5" disabled={busy || !closeSummary || !canClose} onClick={handleClose}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Close shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
