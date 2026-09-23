"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trash2,
  RotateCcw,
  AlertOctagon,
  ArrowLeft,
  Loader2,
  FlaskConical,
  Pill,
  FileText,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FORM_TYPE_LABELS } from "@/lib/routes";
import { formatDate } from "@/lib/date";
import type { SearchResultRecord } from "@/lib/search";
import { restoreRecord, permanentlyDeleteRecord } from "@/lib/actions/records-actions";
import { toast } from "sonner";

export function TrashView() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [records, setRecords] = useState<SearchResultRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Restore Target State
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Permanent Delete Modal State
  const [permTarget, setPermTarget] = useState<SearchResultRecord | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deletingPerm, setDeletingPerm] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchTrashRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      params.set("onlyTrash", "true");
      params.set("limit", "100");

      const res = await fetch(`/api/records/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch trash records:", err);
      toast.error("Failed to load trash records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrashRecords();
  }, [debouncedQuery]);

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      await restoreRecord(id);
      toast.success("Record restored successfully");
      fetchTrashRecords();
    } catch (err) {
      console.error("Restore error:", err);
      toast.error("Failed to restore record");
    } finally {
      setRestoringId(null);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!permTarget || confirmText.toUpperCase() !== "DELETE") return;
    setDeletingPerm(true);
    try {
      await permanentlyDeleteRecord(permTarget.id);
      toast.success("Record permanently deleted");
      setPermTarget(null);
      setConfirmText("");
      fetchTrashRecords();
    } catch (err) {
      console.error("Permanent delete error:", err);
      toast.error("Failed to permanently delete record");
    } finally {
      setDeletingPerm(false);
    }
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1 pl-0">
              <Link href="/records">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Records
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            Trash Bin
            <Badge variant="destructive" className="text-xs font-semibold">
              {total} Item{total === 1 ? "" : "s"}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Soft-deleted medical records. Records in Trash are automatically purged after 30 days.
          </p>
        </div>
      </div>

      {/* Info Alert Box */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200">
        <AlertOctagon className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div>
          <strong className="font-semibold block text-sm">Super Admin Notice</strong>
          <p className="mt-0.5 leading-relaxed">
            All public share links for records in Trash are automatically revoked. You can restore any record to its original state or permanently delete it now.
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter trash items by patient name, hospital number, or diagnosis..."
          className="pl-9 h-10 text-sm"
        />
      </div>

      {/* Trash Records Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-brand-green" />
            <span>Loading Trash records...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Trash2 className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="font-semibold text-foreground">Trash is empty</p>
            <p className="text-xs mt-1">No deleted medical records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="p-3">Patient Name & Hosp No</th>
                  <th className="p-3">Form Type</th>
                  <th className="p-3">Deleted Date</th>
                  <th className="p-3">Deleted By</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((record) => {
                  const typeLabel = FORM_TYPE_LABELS[record.type] || record.type;
                  const isRestoring = restoringId === record.id;

                  return (
                    <tr key={record.id} className="hover:bg-muted/30 transition-colors">
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
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {record.deletedAt ? formatDate(record.deletedAt) : "N/A"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {record.createdByName}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isRestoring}
                            onClick={() => handleRestore(record.id)}
                            className="h-8 text-xs gap-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          >
                            {isRestoring ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setPermTarget(record);
                              setConfirmText("");
                            }}
                            className="h-8 text-xs gap-1.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Permanent Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Permanent Delete Modal (Requires typing DELETE) */}
      <Dialog
        open={Boolean(permTarget)}
        onOpenChange={(o: boolean) => {
          if (!o) {
            setPermTarget(null);
            setConfirmText("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertOctagon className="h-5 w-5" /> Delete Permanently?
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 space-y-2">
              <p>
                This action <strong className="text-rose-600">CANNOT BE UNDONE</strong>. The medical record for{" "}
                <strong>
                  {permTarget?.patient.surname}, {permTarget?.patient.firstNames}
                </strong>{" "}
                ({permTarget?.patient.hospitalNumber}) and all its preview assets will be permanently removed from the database.
              </p>
              <p>
                Please type <strong className="font-mono text-foreground">DELETE</strong> below to confirm.
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="h-9 text-xs font-mono uppercase"
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPermTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={confirmText.toUpperCase() !== "DELETE" || deletingPerm}
              onClick={handleConfirmPermanentDelete}
              className="gap-1.5"
            >
              {deletingPerm && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
