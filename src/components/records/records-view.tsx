"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Trash2,
  Eye,
  Download,
  Share2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Pill,
  FileText,
  RotateCcw,
  Loader2,
  Calendar,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FORM_ROUTES, FORM_TYPE_LABELS } from "@/lib/routes";
import { formatDate } from "@/lib/date";
import type { SearchResultRecord } from "@/lib/search";
import { softDeleteRecord, bulkSoftDeleteRecords } from "@/lib/actions/records-actions";
import { PdfPreviewDialog } from "@/components/forms/pdf-preview-dialog";
import { ShareDialog } from "@/components/forms/share-dialog";
import { toast } from "sonner";

type Props = {
  isSuperAdmin: boolean;
  currentUserId: string;
  adminUsers: { id: string; name: string; email: string }[];
};

export function RecordsView({ isSuperAdmin, currentUserId, adminUsers }: Props) {
  const router = useRouter();

  // Search & Filter State
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [formType, setFormType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [createdBy, setCreatedBy] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // Data state
  const [records, setRecords] = useState<SearchResultRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Selection state (Super Admin)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Single Delete State
  const [deleteTarget, setDeleteTarget] = useState<SearchResultRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Preview & Share Modals
  const [previewTarget, setPreviewTarget] = useState<SearchResultRecord | null>(null);
  const [shareTarget, setShareTarget] = useState<SearchResultRecord | null>(null);

  // ~300ms Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch records
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (formType !== "all") params.set("type", formType);
      if (status !== "all") params.set("status", status);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (createdBy) params.set("createdBy", createdBy);
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      const res = await fetch(`/api/records/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error("Failed to fetch records:", err);
      toast.error("Failed to load records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [debouncedQuery, formType, status, startDate, endDate, createdBy, page, limit]);

  // Select all handler
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(records.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Soft delete single
  const handleConfirmSingleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await softDeleteRecord(deleteTarget.id);
      toast.success("Record moved to Trash");
      setDeleteTarget(null);
      fetchRecords();
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete record");
    } finally {
      setDeleting(false);
    }
  };

  // Bulk soft delete
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const res = await bulkSoftDeleteRecords(selectedIds);
      toast.success(`${res.count} record(s) moved to Trash`);
      setSelectedIds([]);
      setShowBulkDeleteModal(false);
      fetchRecords();
    } catch (err) {
      console.error("Bulk delete failed:", err);
      toast.error("Failed to delete selected records");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleResetFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setFormType("all");
    setStatus("all");
    setStartDate("");
    setEndDate("");
    setCreatedBy("");
    setPage(1);
  };

  const getFormIcon = (type: string) => {
    switch (type) {
      case "lab":
        return <FlaskConical className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "prescription":
        return <Pill className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "medical_report":
        return <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      default:
        return null;
    }
  };

  const isFiltered =
    query || formType !== "all" || status !== "all" || startDate || endDate || createdBy;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            Medical Records
            <Badge variant="secondary" className="text-xs font-semibold">
              {total} Total
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search, filter, preview, download, and manage patient medical records.
          </p>
        </div>

        {isSuperAdmin && (
          <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
            <Link href="/records/trash">
              <Trash2 className="h-4 w-4 text-rose-500" />
              <span>Trash Bin</span>
            </Link>
          </Button>
        )}
      </div>

      {/* Search & Filters Section */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by patient surname, first names, hospital no., prescriber, drugs, diagnosis..."
            className="pl-9 h-10 text-sm"
          />
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Form Type Filter */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1 uppercase tracking-wider">
              Form Type
            </label>
            <select
              value={formType}
              onChange={(e) => {
                setFormType(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Form Types</option>
              <option value="lab">Laboratory Requests</option>
              <option value="prescription">Prescriptions</option>
              <option value="medical_report">Medical Reports</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1 uppercase tracking-wider">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Drafts Only</option>
              <option value="completed">Completed Only</option>
            </select>
          </div>

          {/* Start Date Filter */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1 uppercase tracking-wider">
              From Date
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs"
            />
          </div>

          {/* End Date Filter */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1 uppercase tracking-wider">
              To Date
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs"
            />
          </div>

          {/* Created By Filter */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1 uppercase tracking-wider">
              Created By
            </label>
            <select
              value={createdBy}
              onChange={(e) => {
                setCreatedBy(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All Admins</option>
              {adminUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Reset Indicator */}
        {isFiltered && (
          <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
            <span className="text-muted-foreground">Active filters applied</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset Filters
            </Button>
          </div>
        )}
      </div>

      {/* Super Admin Bulk Bar */}
      {isSuperAdmin && selectedIds.length > 0 && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 flex items-center justify-between gap-4 text-xs">
          <span className="font-semibold text-rose-700 dark:text-rose-300">
            {selectedIds.length} record{selectedIds.length === 1 ? "" : "s"} selected
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowBulkDeleteModal(true)}
            className="gap-2"
          >
            <Trash2 className="h-3.5 w-3.5" /> Move Selected to Trash
          </Button>
        </div>
      )}

      {/* Records Table / Cards */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-brand-green" />
            <span>Loading medical records...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">No records found</p>
            <p className="text-xs mt-1">Try adjusting your search query or filters.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    {isSuperAdmin && (
                      <th className="p-3 w-10 text-center">
                        <Checkbox
                          checked={selectedIds.length === records.length && records.length > 0}
                          onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                          aria-label="Select all"
                        />
                      </th>
                    )}
                    <th className="p-3">Patient Name & Hosp No</th>
                    <th className="p-3">Form Type</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Details / Doctor</th>
                    <th className="p-3">Created By</th>
                    <th className="p-3">Updated Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.map((record) => {
                    const isSelected = selectedIds.includes(record.id);
                    const typeLabel = FORM_TYPE_LABELS[record.type] || record.type;
                    const filename = `${typeLabel.replace(/\s+/g, "_")}_${record.patient.surname}_${record.patient.hospitalNumber.replace(/\//g, "-")}.pdf`;

                    return (
                      <tr
                        key={record.id}
                        className={`hover:bg-muted/30 transition-colors ${isSelected ? "bg-muted/50" : ""}`}
                      >
                        {isSuperAdmin && (
                          <td className="p-3 text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelect(record.id)}
                              aria-label={`Select record for ${record.patient.surname}`}
                            />
                          </td>
                        )}
                        <td className="p-3">
                          <div className="font-semibold text-foreground">
                            {record.patient.surname}, {record.patient.firstNames}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {record.patient.hospitalNumber}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            {getFormIcon(record.type)}
                            <span>{typeLabel}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={record.status === "completed" ? "default" : "secondary"}
                            className={record.status === "completed" ? "bg-emerald-600 text-white text-[10px]" : "text-[10px]"}
                          >
                            {record.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground truncate max-w-xs">
                          {record.summarySnippet}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {record.createdByName}
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {formatDate(record.updatedAt)}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              asChild
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Open Record"
                            >
                              <Link href={`${FORM_ROUTES[record.type]}?recordId=${record.id}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Preview Document"
                              onClick={() => setPreviewTarget(record)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              asChild
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Download A4 PDF"
                            >
                              <a href={`/api/forms/${record.id}/pdf`} download={filename}>
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Share Document"
                              onClick={() => setShareTarget(record)}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                            {isSuperAdmin && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Move to Trash"
                                onClick={() => setDeleteTarget(record)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="block md:hidden divide-y divide-border">
              {records.map((record) => {
                const typeLabel = FORM_TYPE_LABELS[record.type] || record.type;
                const filename = `${typeLabel.replace(/\s+/g, "_")}_${record.patient.surname}_${record.patient.hospitalNumber.replace(/\//g, "-")}.pdf`;

                return (
                  <div key={record.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-foreground">
                          {record.patient.surname}, {record.patient.firstNames}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {record.patient.hospitalNumber}
                        </div>
                      </div>
                      <Badge
                        variant={record.status === "completed" ? "default" : "secondary"}
                        className={record.status === "completed" ? "bg-emerald-600 text-white text-[10px]" : "text-[10px]"}
                      >
                        {record.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {getFormIcon(record.type)}
                      <span className="font-semibold text-foreground">{typeLabel}</span>
                      <span>•</span>
                      <span>{formatDate(record.updatedAt)}</span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/40 p-2 rounded-md">
                      {record.summarySnippet}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-muted-foreground">
                        By {record.createdByName}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1">
                          <Link href={`${FORM_ROUTES[record.type]}?recordId=${record.id}`}>
                            Open
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setPreviewTarget(record)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setShareTarget(record)}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-rose-500"
                            onClick={() => setDeleteTarget(record)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
              <div>
                Showing {records.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
                {Math.min(page * limit, total)} of {total} records
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span>Per page:</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-7 rounded border border-input bg-background px-1.5 text-xs text-foreground focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="font-semibold text-foreground px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Single Soft-Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" /> Move Record to Trash?
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              This record for{" "}
              <strong>
                {deleteTarget?.patient.surname}, {deleteTarget?.patient.firstNames}
              </strong>{" "}
              ({deleteTarget?.patient.hospitalNumber}) will be moved to the Trash bin. All associated public share links will be immediately revoked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={handleConfirmSingleDelete}
              className="gap-1.5"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Move to Trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Soft-Delete Confirmation Dialog */}
      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" /> Move {selectedIds.length} Records to Trash?
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Are you sure you want to move <strong>{selectedIds.length} selected records</strong> to the Trash bin? All active share links associated with these records will be revoked immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowBulkDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={bulkDeleting}
              onClick={handleConfirmBulkDelete}
              className="gap-1.5"
            >
              {bulkDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Move Selected to Trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      {previewTarget && (
        <PdfPreviewDialog
          open={Boolean(previewTarget)}
          onOpenChange={(o) => !o && setPreviewTarget(null)}
          recordId={previewTarget.id}
          filename={`${FORM_TYPE_LABELS[previewTarget.type] || previewTarget.type}_${previewTarget.patient.surname}_${previewTarget.patient.hospitalNumber.replace(/\//g, "-")}.pdf`}
        />
      )}

      {/* Share Dialog Modal */}
      {shareTarget && (
        <ShareDialog
          open={Boolean(shareTarget)}
          onOpenChange={(o) => !o && setShareTarget(null)}
          recordId={shareTarget.id}
          filename={`${FORM_TYPE_LABELS[shareTarget.type] || shareTarget.type}_${shareTarget.patient.surname}_${shareTarget.patient.hospitalNumber.replace(/\//g, "-")}.pdf`}
        />
      )}
    </div>
  );
}
