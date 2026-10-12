"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RegisterPatientModal } from "@/components/patients/register-patient-modal";
import { PatientCaseFileModal, type PatientRecord } from "@/components/patients/patient-case-file-modal";
import { ExportPatientsModal } from "@/components/patients/export-patients-modal";
import { CashierPaymentModal } from "@/components/patients/cashier-payment-modal";
import { useSession } from "@/lib/auth-client";
import { formatDate } from "@/lib/date";
import { toast } from "sonner";

export function PatientsView() {
  const { data: session } = useSession();
  const isSuperAdmin = (session?.user as { role?: string })?.role === "super_admin";

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

  useEffect(() => {
    fetchPatients();
  }, [query, activeTab, paymentFilter, page]);

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
        <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 font-medium text-[11px]">
          {st}
        </Badge>
      );
    }
    if (st.includes("ICU")) {
      return (
        <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-rose-200 dark:bg-rose-950 dark:text-rose-300 font-medium text-[11px]">
          {st}
        </Badge>
      );
    }
    if (st.includes("Discharged")) {
      return (
        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200 dark:bg-slate-800 dark:text-slate-300 font-medium text-[11px]">
          Discharged
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 font-medium text-[11px]">
        Outpatient
      </Badge>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER BAR MATCHING IMAGE 3 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <span className="text-xs text-muted-foreground font-medium">Records</span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            Patients
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowExportModal(true)} className="gap-2 text-xs">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button
            size="sm"
            onClick={() => setShowRegisterModal(true)}
            className="gap-2 bg-brand-green hover:bg-emerald-700 text-white font-semibold text-xs"
          >
            <Plus className="h-4 w-4" /> Register patient
          </Button>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BAR (IMAGE 3) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => { setActiveTab("all"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${activeTab === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            All <span className="ml-1 text-[11px] opacity-70">{total}</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("outpatient"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${activeTab === "outpatient" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Outpatient <span className="ml-1 text-[11px] opacity-70">{outpatientCount}</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("inpatient"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${activeTab === "inpatient" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Inpatient <span className="ml-1 text-[11px] opacity-70">{inpatientCount}</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("discharged"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${activeTab === "discharged" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Discharged <span className="ml-1 text-[11px] opacity-70">{dischargedCount}</span>
          </button>
        </div>

        {/* Payment Filter Toggle */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs font-semibold overflow-x-auto">
          <span className="text-[10px] uppercase font-bold text-muted-foreground px-1.5 tracking-wider">
            Payment:
          </span>
          <button
            type="button"
            onClick={() => { setPaymentFilter("all"); setPage(1); }}
            className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${paymentFilter === "all" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"}`}
          >
            All <span className="ml-1 text-[10px] opacity-70">{total}</span>
          </button>
          <button
            type="button"
            onClick={() => { setPaymentFilter("paid"); setPage(1); }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${paymentFilter === "paid" ? "bg-emerald-600 text-white shadow-xs font-bold" : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950"}`}
          >
            <CheckCircle2 className="h-3 w-3" /> Paid <span className="ml-0.5 text-[10px] opacity-80">{paidCount}</span>
          </button>
          <button
            type="button"
            onClick={() => { setPaymentFilter("pending"); setPage(1); }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${paymentFilter === "pending" ? "bg-amber-600 text-white shadow-xs font-bold" : "text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950"}`}
          >
            <Clock className="h-3 w-3" /> Pending <span className="ml-0.5 text-[10px] opacity-80">{pendingPaymentCount}</span>
          </button>
        </div>

        {/* Search & Filter Dropdown */}
        <div className="flex items-center gap-2 flex-1 md:max-w-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, MRN or phone"
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN CONTAINER MATCHING IMAGE 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: PATIENTS TABLE (IMAGE 3) */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-brand-green" /> Loading patients...
            </div>
          ) : patients.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-foreground">No patients registered yet</p>
              <p className="mt-1">Click &quot;Register patient&quot; to create a new Patient Case File.</p>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3">PATIENT</th>
                      <th className="p-3">AGE / SEX</th>
                      <th className="p-3">PAYMENT STATUS</th>
                      <th className="p-3">LAST VISIT</th>
                      <th className="p-3">DOCTOR</th>
                      <th className="p-3">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {patients.map((p) => {
                      const isSelected = selectedPatient?.id === p.id;
                      const initials = getInitials(p.surname, p.firstNames);

                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedPatient(p)}
                          className={`cursor-pointer transition-colors hover:bg-muted/30 ${isSelected ? "bg-muted/60" : ""}`}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {initials}
                              </div>
                              <div>
                                <div className="font-semibold text-foreground text-xs">
                                  {p.firstNames} {p.surname}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  {p.hospitalNumber}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {p.age || "28"} · {p.sex ? p.sex[0] : "M"}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {p.paymentStatus === "paid" ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCashierModalPatient(p);
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold hover:bg-emerald-100 transition-colors shadow-2xs group"
                                title="Payment cleared. Click to view proof / edit."
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 stroke-[2.5]" />
                                <span>PAID</span>
                                {p.paymentAmount ? (
                                  <span className="text-[10px] opacity-75 font-mono">₦{p.paymentAmount}</span>
                                ) : null}
                                {p.paymentEvidenceUrl && (
                                  <span className="text-[10px] bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 px-1 rounded">
                                    📷 Proof
                                  </span>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCashierModalPatient(p);
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 transition-colors shadow-2xs group"
                                title="Payment pending. Click to confirm payment."
                              >
                                <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                <span>PENDING</span>
                                <span className="text-[10px] text-amber-700 underline group-hover:text-amber-900">
                                  Tick
                                </span>
                              </button>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {p.lastVisit || "28 Sep 2026"}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {p.doctor || "Dr. Ibrahim Musa"}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {getStatusBadge(p.status)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARD LIST */}
              <ul className="flex flex-col gap-2 p-3 md:hidden">
                {patients.map((p) => {
                  const isSelected = selectedPatient?.id === p.id;
                  const initials = getInitials(p.surname, p.firstNames);

                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPatient(p)}
                        className={`w-full rounded-lg border border-border p-3 text-left transition-colors ${isSelected ? "bg-muted/60" : "bg-background hover:bg-muted/30"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-foreground text-xs truncate">
                              {p.firstNames} {p.surname}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {p.hospitalNumber}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5">
                            {p.paymentStatus === "paid" ? (
                              <Badge className="bg-emerald-600 text-white text-[10px] font-bold gap-1 px-1.5 py-0.5">
                                <CheckCircle2 className="h-3 w-3" /> PAID
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500 text-white text-[10px] font-bold gap-1 px-1.5 py-0.5 animate-pulse">
                                <Clock className="h-3 w-3" /> PENDING
                              </Badge>
                            )}
                            {getStatusBadge(p.status)}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground border-t border-border pt-2">
                          <span>{p.age || "28"} · {p.sex ? p.sex[0] : "M"}</span>
                          <span className="truncate">{p.doctor || "Dr. Ibrahim Musa"}</span>
                          <span className="whitespace-nowrap">{p.lastVisit || "28 Sep 2026"}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Pagination */}
          <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {patients.length} of {total} patients</span>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="font-semibold text-foreground px-2">{page} / {totalPages}</span>
              <Button size="icon" variant="outline" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SELECTED PATIENT SUMMARY PANEL (IMAGE 3) */}
        {selectedPatient ? (
          <div className="rounded-xl border border-border bg-card p-5 space-y-5 shadow-xs">
            {/* Header Avatar & Name */}
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-emerald-800 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm">
                {getInitials(selectedPatient.surname, selectedPatient.firstNames)}
              </div>
              <div>
                <h2 className="font-bold text-base text-foreground">
                  {selectedPatient.firstNames} {selectedPatient.surname}
                </h2>
                <p className="text-xs text-muted-foreground font-mono">
                  {selectedPatient.hospitalNumber} · {selectedPatient.age || "27"} yrs · {selectedPatient.sex || "Female"}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {getStatusBadge(selectedPatient.status)}
                  <Badge variant="secondary" className="text-[10px] text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300">
                    Blood {selectedPatient.bloodGroup || "B+"}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] text-purple-700 bg-purple-50 dark:bg-purple-950 dark:text-purple-300">
                    Genotype {selectedPatient.genotype || "AA"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Allergy Warning Banner (Image 3) */}
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <span className="font-semibold">
                Allergies: {selectedPatient.allergies || "Penicillin"}
              </span>
            </div>

            {/* CASHIER PAYMENT CLEARANCE CARD */}
            <div
              className={`rounded-xl border p-3.5 space-y-2.5 transition-colors ${
                selectedPatient.paymentStatus === "paid"
                  ? "border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30 dark:border-emerald-800"
                  : "border-amber-300 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className={`h-4 w-4 ${selectedPatient.paymentStatus === "paid" ? "text-emerald-700" : "text-amber-700"}`} />
                  <span className="font-bold text-xs text-foreground uppercase tracking-wider">
                    Hospital Billing & Payment
                  </span>
                </div>

                {selectedPatient.paymentStatus === "paid" ? (
                  <Badge className="bg-emerald-600 text-white font-bold text-[11px] gap-1 px-2 py-0.5 shadow-2xs">
                    <CheckCircle2 className="h-3 w-3 stroke-[2.5]" /> PAID ✓
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500 text-white font-bold text-[11px] gap-1 px-2 py-0.5 animate-pulse shadow-2xs">
                    <Clock className="h-3 w-3" /> PENDING
                  </Badge>
                )}
              </div>

              <div className="text-xs space-y-1">
                {selectedPatient.paymentStatus === "paid" ? (
                  <>
                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span>Amount: <strong className="text-foreground">{selectedPatient.paymentAmount ? `₦${selectedPatient.paymentAmount}` : "Cleared"}</strong></span>
                      <span>Method: <strong className="text-foreground">{selectedPatient.paymentMethod || "POS"}</strong></span>
                    </div>
                    {selectedPatient.paymentReference && (
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Ref: {selectedPatient.paymentReference}
                      </p>
                    )}
                    {selectedPatient.paymentConfirmedBy && (
                      <p className="text-[10px] text-muted-foreground">
                        Verified by: <strong className="text-foreground">{selectedPatient.paymentConfirmedBy}</strong>
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-amber-900 dark:text-amber-200">
                    Awaiting cashier payment clearance. Tick below after confirming POS, cash, or transfer.
                  </p>
                )}
              </div>

              {/* Evidence Preview if photo is attached */}
              {selectedPatient.paymentEvidenceUrl && (
                <div className="rounded-lg border border-border bg-background/80 p-2 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded border bg-card overflow-hidden shrink-0">
                      <img
                        src={selectedPatient.paymentEvidenceUrl}
                        alt="Payment Evidence"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold text-foreground truncate block max-w-[130px]">
                        {selectedPatient.paymentEvidenceName || "Proof Photo"}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-medium block">✓ Screenshot Attached</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCashierModalPatient(selectedPatient)}
                    className="h-6 text-[10px] px-2 gap-1"
                  >
                    <Eye className="h-3 w-3" /> View
                  </Button>
                </div>
              )}

              <Button
                size="sm"
                onClick={() => setCashierModalPatient(selectedPatient)}
                className={`w-full text-xs font-bold gap-1.5 h-8 text-white shadow-2xs ${
                  selectedPatient.paymentStatus === "paid"
                    ? "bg-emerald-700 hover:bg-emerald-600"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {selectedPatient.paymentStatus === "paid" ? (
                  <>
                    <CreditCard className="h-3.5 w-3.5" /> Update Payment / Proof
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirm Payment (Cashier Desk)
                  </>
                )}
              </Button>
            </div>

            {/* Latest Vitals Grid (Image 3) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">Latest vitals</span>
                <span className="text-[11px] text-muted-foreground">Today, 09:50</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2 border border-border">
                  <span className="text-[10px] text-muted-foreground font-medium block">BP</span>
                  <span className="font-bold text-xs text-foreground">124/80</span>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 border border-border">
                  <span className="text-[10px] text-muted-foreground font-medium block">Pulse</span>
                  <span className="font-bold text-xs text-foreground">88</span>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 border border-border">
                  <span className="text-[10px] text-muted-foreground font-medium block">Temp</span>
                  <span className="font-bold text-xs text-foreground">37.1°C</span>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 border border-border">
                  <span className="text-[10px] text-muted-foreground font-medium block">SpO₂</span>
                  <span className="font-bold text-xs text-foreground">98%</span>
                </div>
              </div>
            </div>

            {/* Active Prescriptions (Image 3) */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-foreground">Active prescriptions</span>
              <ul className="space-y-1 text-muted-foreground pl-3 list-disc text-xs">
                <li><strong className="text-foreground">Folic acid 5mg</strong> — 1 tab daily</li>
                <li><strong className="text-foreground">Paracetamol 1g</strong> — Every 8 hrs</li>
              </ul>
            </div>

            {/* Recent Visits (Image 3) */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-foreground">Recent visits</span>
              <div className="space-y-1.5 text-muted-foreground text-xs">
                <div>
                  <p className="font-semibold text-foreground">Admitted to Maternity, Bed M-04</p>
                  <p className="text-[11px]">28 Sep 2026 · {selectedPatient.doctor || "Dr. Hauwa Sani"}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Antenatal visit</p>
                  <p className="text-[11px]">14 Sep 2026 · {selectedPatient.doctor || "Dr. Hauwa Sani"}</p>
                </div>
              </div>
            </div>

            {/* Quick Form Actions for This Patient (Image 3) */}
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-[11px] font-semibold text-muted-foreground block uppercase">
                New form for this patient
              </span>
              <div className="grid grid-cols-3 gap-2">
                <Button asChild variant="outline" size="sm" className="h-8 text-[11px]">
                  <Link href={`/lab?patientId=${selectedPatient.id}`}>
                    <FlaskConical className="h-3 w-3 mr-1 text-emerald-600" /> Lab request
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8 text-[11px]">
                  <Link href={`/prescription?patientId=${selectedPatient.id}`}>
                    <Pill className="h-3 w-3 mr-1 text-blue-600" /> Prescription
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8 text-[11px]">
                  <Link href={`/medical-report?patientId=${selectedPatient.id}`}>
                    <FileText className="h-3 w-3 mr-1 text-amber-600" /> Medical report
                  </Link>
                </Button>
              </div>
            </div>

            {/* Primary Action: Open Full Case File Folder */}
            <div className="space-y-2 pt-1">
              <Button
                onClick={() => setShowCaseFileModal(true)}
                className="w-full bg-brand-green hover:bg-emerald-700 text-white font-bold h-10 gap-2 shadow-xs text-xs"
              >
                <FolderOpen className="h-4 w-4" /> Open full record / Case File
              </Button>

              {isSuperAdmin ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingPatient(selectedPatient)}
                  className="w-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950 text-xs gap-1.5 h-9 font-semibold"
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
          <div className="rounded-xl border border-border bg-card p-8 text-center text-xs text-muted-foreground">
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
