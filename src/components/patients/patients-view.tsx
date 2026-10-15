"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Filter,
  Plus,
  Users,
  Download,
  FileText,
  FlaskConical,
  Pill,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  ExternalLink,
  UserCheck,
  FolderOpen,
  Trash2,
  ShieldAlert,
  CreditCard,
  CheckCircle2,
  Clock,
  Eye,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RegisterPatientModal } from "@/components/patients/register-patient-modal";
import { PatientCaseFileModal, type PatientRecord } from "@/components/patients/patient-case-file-modal";
import { ExportPatientsModal } from "@/components/patients/export-patients-modal";
import { CashierPaymentModal } from "@/components/patients/cashier-payment-modal";
import { BulkSendPatientFilesPanel } from "@/components/patients/bulk-send-patient-files-panel";
import { RecentRecordsList } from "@/components/patients/patient-history";
import { bulkDeletePatients } from "@/lib/actions/patients";
import { useSession } from "@/lib/auth-client";
import { formatDate } from "@/lib/date";
import { toast } from "sonner";

export function PatientsView() {
  const { data: session } = useSession();
  const isSuperAdmin = (session?.user as { role?: string })?.role === "super_admin";
  const router = useRouter();
  const searchParams = useSearchParams();

  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);

  // Filters state
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "pending">("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showCaseFileModal, setShowCaseFileModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [cashierModalPatient, setCashierModalPatient] = useState<PatientRecord | null>(null);

  // Deletion state
  const [deletingPatient, setDeletingPatient] = useState<PatientRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkSendModal, setShowBulkSendModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Fetch patients list
  const fetchPatients = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (activeTab !== "all") params.set("status", activeTab);
      if (paymentFilter !== "all") params.set("payment", paymentFilter);
      params.set("page", page.toString());
      params.set("limit", "15");

      const res = await fetch(`/api/patients?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);

        // Auto-select first patient if none selected
        if (data.items && data.items.length > 0 && !selectedPatient) {
          setSelectedPatient(data.items[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch patients:", err);
      toast.error("Failed to load patients");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePatient = async () => {
    if (!deletingPatient) return;
    if (!isSuperAdmin) {
      toast.error("Only Super Admin accounts can delete patient records");
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/patients/${deletingPatient.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success(`Patient case file ${deletingPatient.hospitalNumber} deleted successfully`);
        if (selectedPatient?.id === deletingPatient.id) {
          setSelectedPatient(null);
        }
        setDeletingPatient(null);
        fetchPatients();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete patient");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting patient file");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(patients.map((p) => p.id)) : new Set());
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!isSuperAdmin) {
      toast.error("Only Super Admin accounts can delete patient files");
      return;
    }

    setBulkDeleting(true);
    try {
      const result = await bulkDeletePatients(Array.from(selectedIds));
      toast.success(`${result.count} patient file${result.count === 1 ? "" : "s"} deleted`);
      if (selectedPatient && selectedIds.has(selectedPatient.id)) {
        setSelectedPatient(null);
      }
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
      fetchPatients();
    } catch (err) {
      console.error("Bulk delete failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete selected patient files");
    } finally {
      setBulkDeleting(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [query, activeTab, paymentFilter, page]);

  // Deep link from elsewhere (e.g. the dashboard's "Open file" action): open a
  // specific patient's case file directly, even if it isn't on the current page.
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;

    (async () => {
      try {
        const res = await fetch(`/api/patients/${openId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.patient) {
            setSelectedPatient(data.patient);
            setShowCaseFileModal(true);
          }
        }
      } catch (err) {
        console.error("Failed to open patient file:", err);
      } finally {
        router.replace("/patients");
      }
    })();
  }, [searchParams, router]);

  // Counts for tabs
  const outpatientCount = patients.filter((p) => p.status?.includes("Outpatient")).length;
  const inpatientCount = patients.filter((p) => p.status?.includes("Admitted") || p.status?.includes("Inpatient")).length;
  const dischargedCount = patients.filter((p) => p.status?.includes("Discharged")).length;
  const paidCount = patients.filter((p) => p.paymentStatus === "paid").length;
  const pendingPaymentCount = patients.filter((p) => p.paymentStatus !== "paid").length;

  const getInitials = (surname: string, firstNames: string) => {
    const s = surname ? surname[0] : "";
    const f = firstNames ? firstNames[0] : "";
    return `${f}${s}`.toUpperCase() || "PT";
  };

  const getStatusBadge = (status?: string) => {
    const st = status || "Outpatient";
    if (st.includes("Maternity") || st.includes("Admitted")) {
      return (
        <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-[11px] whitespace-nowrap px-2.5 py-0.5 shadow-2xs">
          {st}
        </Badge>
      );
    }
    if (st.includes("ICU")) {
      return (
        <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-rose-200 dark:bg-rose-950 dark:text-rose-300 font-bold text-[11px] whitespace-nowrap px-2.5 py-0.5 shadow-2xs">
          {st}
        </Badge>
      );
    }
    if (st.includes("Discharged")) {
      return (
        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200 dark:bg-slate-800 dark:text-slate-300 font-bold text-[11px] whitespace-nowrap px-2.5 py-0.5 shadow-2xs">
          Discharged
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[11px] whitespace-nowrap px-2.5 py-0.5 shadow-2xs">
        Outpatient
      </Badge>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Clinical Records</span>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            Patients
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => setShowExportModal(true)} className="gap-2 text-xs font-semibold shadow-2xs">
            <Download className="h-3.5 w-3.5" /> Export Records
          </Button>
          <Button
            size="sm"
            onClick={() => setShowRegisterModal(true)}
            className="gap-2 bg-brand-green hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
          >
            <Plus className="h-4 w-4" /> Register Patient
          </Button>
        </div>
      </div>

      {/* FILTER CONTROLS TOOLBAR */}
      <div className="space-y-3">
        {/* Tier 1: Clinical Status Tabs + Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Clinical Filter Tabs */}
          <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-xl text-xs font-bold overflow-x-auto border border-border/60">
            <button
              type="button"
              onClick={() => { setActiveTab("all"); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-background text-foreground shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All <span className="ml-1 text-[11px] font-semibold opacity-70">{total}</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("outpatient"); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === "outpatient"
                  ? "bg-background text-foreground shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Outpatient <span className="ml-1 text-[11px] font-semibold opacity-70">{outpatientCount}</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("inpatient"); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === "inpatient"
                  ? "bg-background text-foreground shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Inpatient <span className="ml-1 text-[11px] font-semibold opacity-70">{inpatientCount}</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("discharged"); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === "discharged"
                  ? "bg-background text-foreground shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Discharged <span className="ml-1 text-[11px] font-semibold opacity-70">{dischargedCount}</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, MRN, phone..."
              className="pl-9 h-9 text-xs rounded-xl border-border/80 bg-background shadow-2xs"
            />
          </div>
        </div>

        {/* Tier 2: Payment Clearance Status Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl text-xs font-bold border border-border/60">
            <span className="text-[10px] uppercase font-black text-muted-foreground px-2 tracking-wider">
              Payment Status:
            </span>
            <button
              type="button"
              onClick={() => { setPaymentFilter("all"); setPage(1); }}
              className={`px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                paymentFilter === "all"
                  ? "bg-background text-foreground shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Records <span className="ml-1 text-[10px] opacity-75">{total}</span>
            </button>
            <button
              type="button"
              onClick={() => { setPaymentFilter("paid"); setPage(1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                paymentFilter === "paid"
                  ? "bg-emerald-600 text-white shadow-xs font-black"
                  : "text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" /> Paid <span className="ml-0.5 text-[10px] opacity-85">({paidCount})</span>
            </button>
            <button
              type="button"
              onClick={() => { setPaymentFilter("pending"); setPage(1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                paymentFilter === "pending"
                  ? "bg-amber-600 text-white shadow-xs font-black"
                  : "text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/60"
              }`}
            >
              <Clock className="h-3.5 w-3.5 stroke-[2.5]" /> Pending Cashier <span className="ml-0.5 text-[10px] opacity-85">({pendingPaymentCount})</span>
            </button>
          </div>

          <div className="text-[11px] font-semibold text-muted-foreground">
            Showing <strong className="text-foreground">{patients.length}</strong> active patient records
          </div>
        </div>
      </div>

      {/* BULK SELECTION ACTION BAR */}
      {selectedIds.size > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-foreground">
            {selectedIds.size} patient file{selectedIds.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowBulkSendModal(true)} className="gap-2">
              <Send className="h-3.5 w-3.5" /> Send to Colleague(s)
            </Button>
            {isSuperAdmin && (
              <Button size="sm" variant="destructive" onClick={() => setShowBulkDeleteModal(true)} className="gap-2">
                <Trash2 className="h-3.5 w-3.5" /> Delete Selected
              </Button>
            )}
          </div>
        </div>
      )}

      {/* MAIN TWO-COLUMN CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: PATIENTS TABLE */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
              <span className="font-semibold text-foreground">Loading patient records...</span>
            </div>
          ) : patients.length === 0 ? (
            <div className="p-16 text-center text-xs text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40 text-brand-green" />
              <p className="font-bold text-base text-foreground">No matching patients found</p>
              <p className="mt-1 text-xs">Try adjusting your filters or click &quot;Register Patient&quot; above.</p>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[820px] text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-3 w-10 text-center">
                        <Checkbox
                          checked={patients.length > 0 && selectedIds.size === patients.length}
                          onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                          aria-label="Select all patients on this page"
                        />
                      </th>
                      <th className="py-3.5 px-4 min-w-[190px]">PATIENT</th>
                      <th className="py-3.5 px-3 whitespace-nowrap min-w-[90px]">AGE / SEX</th>
                      <th className="py-3.5 px-3 whitespace-nowrap min-w-[210px]">PAYMENT STATUS</th>
                      <th className="py-3.5 px-3 whitespace-nowrap min-w-[110px]">LAST VISIT</th>
                      <th className="py-3.5 px-3 min-w-[140px]">DOCTOR</th>
                      <th className="py-3.5 px-4 whitespace-nowrap min-w-[110px]">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {patients.map((p) => {
                      const isSelected = selectedPatient?.id === p.id;
                      const isChecked = selectedIds.has(p.id);
                      const initials = getInitials(p.surname, p.firstNames);

                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedPatient(p)}
                          className={`cursor-pointer transition-colors hover:bg-muted/40 ${
                            isSelected ? "bg-muted/60 font-medium" : ""
                          }`}
                        >
                          <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleSelect(p.id)}
                              aria-label={`Select patient file for ${p.surname}`}
                            />
                          </td>
                          {/* PATIENT INFO */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs ring-1 ring-emerald-500/20">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-foreground text-xs truncate max-w-[170px]">
                                  {p.firstNames} {p.surname}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  {p.hospitalNumber || "MRN-PENDING"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* AGE / SEX */}
                          <td className="py-3.5 px-3 text-muted-foreground font-semibold whitespace-nowrap">
                            {p.age || "28"} · {p.sex ? (p.sex.length === 1 ? p.sex : p.sex[0].toUpperCase()) : "M"}
                          </td>

                          {/* PAYMENT STATUS COLUMN (DISTINCT COMPACT BADGE + PROMINENT CONFIRM BUTTON) */}
                          <td className="py-3.5 px-3 min-w-[210px] whitespace-nowrap">
                            {p.paymentStatus === "paid" ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-bold text-[11px]">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 stroke-[2.5] shrink-0" />
                                  PAID
                                </span>
                                {p.paymentAmount ? (
                                  <span className="text-[11px] text-foreground font-mono font-bold shrink-0">
                                    ₦{Number(p.paymentAmount).toLocaleString()}
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCashierModalPatient(p);
                                  }}
                                  className="inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground text-[10px] font-semibold transition-colors cursor-pointer"
                                  title="View receipt or update clearance"
                                >
                                  {p.paymentEvidenceUrl ? "📷 Receipt" : "Edit"}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5">
                                <span className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold text-[11px]">
                                  <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                  PENDING
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCashierModalPatient(p);
                                  }}
                                  className="group inline-flex shrink-0 items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-bold shadow-xs hover:from-amber-600 hover:to-orange-600 hover:shadow-md hover:shadow-amber-500/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer"
                                  title="Confirm payment at Cashier Desk"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5] transition-transform duration-200 group-hover:scale-115" />
                                  <span>Confirm</span>
                                </button>
                              </div>
                            )}
                          </td>

                          {/* LAST VISIT */}
                          <td className="py-3.5 px-3 text-muted-foreground whitespace-nowrap font-medium">
                            {p.lastVisit || "28 Sep 2026"}
                          </td>

                          {/* DOCTOR */}
                          <td className="py-3.5 px-3 text-muted-foreground truncate max-w-[150px]">
                            {p.doctor || "Dr. Ibrahim Musa"}
                          </td>

                          {/* STATUS BADGE */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {getStatusBadge(p.status)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARD LIST */}
              <ul className="flex flex-col gap-2.5 p-3 md:hidden">
                {patients.map((p) => {
                  const isSelected = selectedPatient?.id === p.id;
                  const isChecked = selectedIds.has(p.id);
                  const initials = getInitials(p.surname, p.firstNames);

                  return (
                    <li key={p.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedPatient(p)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setSelectedPatient(p);
                        }}
                        className={`w-full rounded-xl border border-border p-3.5 text-left transition-colors shadow-2xs cursor-pointer ${
                          isSelected ? "bg-muted/60 ring-2 ring-brand-green/30" : "bg-background hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleSelect(p.id)}
                              aria-label={`Select patient file for ${p.surname}`}
                            />
                          </div>
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-foreground text-xs truncate">
                              {p.firstNames} {p.surname}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {p.hospitalNumber || "MRN-PENDING"}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5">
                            {p.paymentStatus === "paid" ? (
                              <Badge className="bg-emerald-600 text-white text-[10px] font-bold gap-1 px-2 py-0.5 shadow-2xs">
                                <CheckCircle2 className="h-3 w-3 stroke-[2.5]" /> PAID
                              </Badge>
                            ) : (
                              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold gap-1 px-2 py-0.5 shadow-2xs">
                                <Clock className="h-3 w-3 stroke-[2.5]" /> PENDING
                              </Badge>
                            )}
                            {getStatusBadge(p.status)}
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground border-t border-border pt-2 font-medium">
                          <span>{p.age || "28"} · {p.sex ? (p.sex.length === 1 ? p.sex : p.sex[0].toUpperCase()) : "M"}</span>
                          <span className="truncate">{p.doctor || "Dr. Ibrahim Musa"}</span>
                          <span className="whitespace-nowrap">{p.lastVisit || "28 Sep 2026"}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Pagination */}
          <div className="p-3.5 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing <strong className="text-foreground">{patients.length}</strong> of <strong className="text-foreground">{total}</strong> patients</span>
            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="outline" className="h-7 w-7 rounded-lg" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="font-bold text-foreground px-2">{page} / {totalPages}</span>
              <Button size="icon" variant="outline" className="h-7 w-7 rounded-lg" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SELECTED PATIENT SUMMARY PANEL */}
        {selectedPatient ? (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4.5 shadow-xs">
            {/* Header Avatar & Name */}
            <div className="flex items-start gap-3.5">
              <div className="h-13 w-13 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-extrabold text-lg flex items-center justify-center shrink-0 shadow-sm ring-4 ring-emerald-500/10">
                {getInitials(selectedPatient.surname, selectedPatient.firstNames)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-black text-base sm:text-lg text-foreground tracking-tight break-words">
                  {selectedPatient.firstNames} {selectedPatient.surname}
                </h2>
                <p className="text-xs text-muted-foreground font-mono font-medium mt-0.5">
                  {selectedPatient.hospitalNumber} · {selectedPatient.age || "27"} yrs · {selectedPatient.sex || "Female"}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {getStatusBadge(selectedPatient.status)}
                  <Badge variant="secondary" className="text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300">
                    Blood {selectedPatient.bloodGroup || "B+"}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300">
                    Genotype {selectedPatient.genotype || "AA"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Allergy Warning Banner (Clean Clinical Alert) */}
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/30 p-3 shadow-2xs flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-red-600 text-white shrink-0 shadow-2xs">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Clinical Allergy Alert
                </div>
                <div className="text-xs font-bold text-foreground break-words">
                  Allergies: {selectedPatient.allergies || "Penicillin"}
                </div>
              </div>
            </div>

            {/* CASHIER PAYMENT CLEARANCE CARD (RESPONSIVE HEADER & NON-OVERFLOWING BADGE) */}
            <div
              className={`rounded-2xl border-2 p-4.5 sm:p-5 space-y-3.5 shadow-xs transition-all ${
                selectedPatient.paymentStatus === "paid"
                  ? "border-emerald-500/80 bg-card hover:border-emerald-600"
                  : "border-amber-500/80 bg-card hover:border-amber-600"
              }`}
            >
              {/* Header: Responsive flex layout preventing badge clipping */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-xs text-white shrink-0 mt-0.5 ${
                      selectedPatient.paymentStatus === "paid"
                        ? "bg-gradient-to-br from-emerald-600 to-teal-700 shadow-emerald-600/20"
                        : "bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/20"
                    }`}
                  >
                    <CreditCard className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-xs uppercase tracking-wider text-foreground leading-snug">
                      Hospital Billing Clearance
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                      Cashier Clearance Desk
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {selectedPatient.paymentStatus === "paid" ? (
                    <Badge className="bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-black text-[11px] gap-1 px-2.5 py-0.5 shadow-2xs whitespace-nowrap">
                      <CheckCircle2 className="h-3 w-3 stroke-[2.5]" /> CLEARED
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-black text-[11px] gap-1 px-2.5 py-0.5 shadow-2xs whitespace-nowrap">
                      <Clock className="h-3 w-3 stroke-[2.5] animate-pulse" /> PENDING
                    </Badge>
                  )}
                </div>
              </div>

              {/* Clearance Details / Instructions */}
              <div className="text-xs space-y-2">
                {selectedPatient.paymentStatus === "paid" ? (
                  <div className="rounded-xl bg-slate-50 dark:bg-muted/40 border border-slate-200/80 dark:border-border/60 p-3.5 space-y-2 text-xs shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[11px] font-medium">Cleared Amount</span>
                      <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-300">
                        ₦{selectedPatient.paymentAmount ? Number(selectedPatient.paymentAmount).toLocaleString() : "Cleared"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground font-medium">Payment Mode</span>
                      <Badge variant="secondary" className="font-semibold text-xs border border-emerald-300/80 dark:border-emerald-700 bg-emerald-100/50 text-emerald-900 dark:text-emerald-200">
                        {selectedPatient.paymentMethod || "POS Terminal"}
                      </Badge>
                    </div>
                    {selectedPatient.paymentReference && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground font-medium">Reference</span>
                        <code className="font-mono text-[10px] bg-background px-1.5 py-0.5 rounded border border-border text-foreground font-semibold">
                          {selectedPatient.paymentReference}
                        </code>
                      </div>
                    )}
                    {selectedPatient.paymentConfirmedBy && (
                      <div className="flex items-center justify-between text-[11px] border-t border-border/50 pt-2">
                        <span className="text-muted-foreground font-medium">Cleared By</span>
                        <span className="font-bold text-foreground text-[11px]">
                          {selectedPatient.paymentConfirmedBy}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 p-3.5 text-xs text-muted-foreground leading-relaxed flex items-start gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 mt-0.5">
                      <Clock className="h-3.5 w-3.5 stroke-[2.5]" />
                    </div>
                    <p className="flex-1 text-xs text-muted-foreground leading-relaxed">
                      Awaiting cashier confirmation. Verify payment via POS terminal, transfer alert, or cash collection, then click below to clear and attach proof.
                    </p>
                  </div>
                )}
              </div>

              {/* Evidence Preview if photo is attached */}
              {selectedPatient.paymentEvidenceUrl && (
                <div className="rounded-xl border border-border bg-background p-2.5 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-10 w-10 rounded-lg border bg-card overflow-hidden shrink-0 shadow-2xs">
                      <img
                        src={selectedPatient.paymentEvidenceUrl}
                        alt="Payment Evidence"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-foreground truncate block max-w-[130px]">
                        {selectedPatient.paymentEvidenceName || "Payment Receipt"}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 stroke-[2.5]" /> Proof Attached
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCashierModalPatient(selectedPatient)}
                    className="h-7 text-xs px-2.5 gap-1 font-semibold rounded-lg"
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </Button>
                </div>
              )}

              {/* ULTRA-COOL HOVER CONFIRM BUTTON */}
              {selectedPatient.paymentStatus === "paid" ? (
                <Button
                  size="sm"
                  onClick={() => setCashierModalPatient(selectedPatient)}
                  className="group relative w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white font-black text-xs shadow-md shadow-emerald-700/25 hover:shadow-xl hover:shadow-emerald-700/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 ease-out overflow-hidden cursor-pointer border border-emerald-400/40"
                >
                  {/* Shimmer sweep effect on hover */}
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />
                  <span className="relative flex items-center justify-center gap-2">
                    <CreditCard className="h-4 w-4 transition-transform duration-300 ease-out group-hover:scale-125 group-hover:-rotate-6" />
                    <span className="tracking-wide">Update Payment / View Receipt</span>
                  </span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setCashierModalPatient(selectedPatient)}
                  className="group relative w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white font-black text-xs shadow-md shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 ease-out overflow-hidden cursor-pointer border border-amber-400/40"
                >
                  {/* Shimmer sweep effect on hover */}
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />
                  <span className="relative flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4 stroke-[2.5] transition-transform duration-300 ease-out group-hover:scale-125 group-hover:rotate-6" />
                    <span className="tracking-wide">Confirm Payment (Cashier Desk)</span>
                  </span>
                </Button>
              )}
            </div>

            {/* Latest Vitals Grid */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">Latest Vitals</span>
                <span className="text-[11px] text-muted-foreground font-medium">Today, 09:50</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-2.5 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                  <span className="text-[10px] text-muted-foreground font-bold block uppercase tracking-wider">BP</span>
                  <span className="font-black text-xs text-foreground mt-0.5 block">124/80</span>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-2.5 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                  <span className="text-[10px] text-muted-foreground font-bold block uppercase tracking-wider">Pulse</span>
                  <span className="font-black text-xs text-foreground mt-0.5 block">88 bpm</span>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-2.5 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                  <span className="text-[10px] text-muted-foreground font-bold block uppercase tracking-wider">Temp</span>
                  <span className="font-black text-xs text-foreground mt-0.5 block">37.1°C</span>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-2.5 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                  <span className="text-[10px] text-muted-foreground font-bold block uppercase tracking-wider">SpO₂</span>
                  <span className="font-black text-xs text-foreground mt-0.5 block">98%</span>
                </div>
              </div>
            </div>

            {/* Treatment Records (real data, newest first) */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-foreground">Recent Records</span>
              <RecentRecordsList patientId={selectedPatient.id} />
            </div>

            {/* Quick Form Actions for This Patient */}
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-[10px] font-bold text-muted-foreground block uppercase tracking-wider">
                New Form for this Patient
              </span>
              <div className="grid grid-cols-3 gap-2">
                <Button asChild variant="outline" size="sm" className="h-8 text-[11px] rounded-lg font-semibold shadow-2xs">
                  <Link href={`/lab?patientId=${selectedPatient.id}`}>
                    <FlaskConical className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Lab request
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8 text-[11px] rounded-lg font-semibold shadow-2xs">
                  <Link href={`/prescription?patientId=${selectedPatient.id}`}>
                    <Pill className="h-3.5 w-3.5 mr-1 text-blue-600" /> Rx
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8 text-[11px] rounded-lg font-semibold shadow-2xs">
                  <Link href={`/medical-report?patientId=${selectedPatient.id}`}>
                    <FileText className="h-3.5 w-3.5 mr-1 text-amber-600" /> Report
                  </Link>
                </Button>
              </div>
            </div>

            {/* Primary Action: Open Full Case File Folder */}
            <div className="space-y-2 pt-1">
              <Button
                onClick={() => setShowCaseFileModal(true)}
                className="w-full bg-brand-green hover:bg-emerald-700 text-white font-bold h-10 gap-2 shadow-xs text-xs rounded-xl"
              >
                <FolderOpen className="h-4 w-4" /> Open Full Record / Case File
              </Button>

              {isSuperAdmin ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingPatient(selectedPatient)}
                  className="w-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950 text-xs gap-1.5 h-9 font-semibold rounded-xl"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Patient File (Super Admin)
                </Button>
              ) : (
                <p className="text-[11px] text-center text-muted-foreground/70 italic pt-1">
                  🔒 Patient file deletion is restricted to Super Admin accounts.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-xs text-muted-foreground">
            Select a patient from the list to view their summary and case file.
          </div>
        )}
      </div>

      {/* Register New Patient Modal */}
      <RegisterPatientModal
        open={showRegisterModal}
        onOpenChange={setShowRegisterModal}
        onRegistered={fetchPatients}
      />

      {/* Full Patient Case File Folder Modal */}
      {selectedPatient && (
        <PatientCaseFileModal
          open={showCaseFileModal}
          onOpenChange={setShowCaseFileModal}
          patient={selectedPatient}
          onUpdated={fetchPatients}
        />
      )}

      {/* Export Hospital Records Modal */}
      <ExportPatientsModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
      />

      {/* Bulk Send Patient Files to Colleague(s) Dialog */}
      <Dialog open={showBulkSendModal} onOpenChange={setShowBulkSendModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" /> Send Patient File(s) to Colleague(s)
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Send the selected patient files to one or more colleagues via internal messages.
            </DialogDescription>
          </DialogHeader>
          <BulkSendPatientFilesPanel
            patientIds={Array.from(selectedIds)}
            onSent={() => {
              setShowBulkSendModal(false);
              setSelectedIds(new Set());
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog (Super Admin) */}
      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5" /> Delete {selectedIds.size} Patient File{selectedIds.size === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Are you sure you want to permanently delete <strong>{selectedIds.size} selected patient file{selectedIds.size === 1 ? "" : "s"}</strong>? This will erase their case files, medical history, lab requests, prescriptions, and medical reports. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowBulkDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={bulkDeleting}
              onClick={handleConfirmBulkDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5"
            >
              {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Super Admin Delete Patient Confirmation Dialog */}
      <Dialog open={Boolean(deletingPatient)} onOpenChange={(open) => !open && setDeletingPatient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5" /> Delete Patient File
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs pt-2 text-foreground">
            <p className="leading-relaxed font-medium">
              Are you sure you want to permanently delete the patient file for{" "}
              <strong className="text-foreground font-bold">
                {deletingPatient?.firstNames} {deletingPatient?.surname}
              </strong>{" "}
              (<code className="font-mono text-xs">{deletingPatient?.hospitalNumber}</code>)?
            </p>

            <div className="rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950/40 p-3 text-rose-800 dark:text-rose-300 text-[11px] leading-relaxed">
              <strong>Warning:</strong> This will permanently erase the patient&apos;s case file, medical history, lab requests, prescriptions, and medical reports. This action cannot be undone.
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDeletingPatient(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isDeleting}
                onClick={handleDeletePatient}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5"
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Confirm Delete
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cashier Payment Modal */}
      {cashierModalPatient && (
        <CashierPaymentModal
          open={Boolean(cashierModalPatient)}
          onOpenChange={(open) => {
            if (!open) setCashierModalPatient(null);
          }}
          patient={cashierModalPatient}
          onUpdated={(updated) => {
            fetchPatients();
            if (selectedPatient?.id === cashierModalPatient.id && updated) {
              setSelectedPatient(updated);
            }
          }}
        />
      )}
    </div>
  );
}
