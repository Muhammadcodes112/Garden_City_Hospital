"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, FlaskConical, Loader2, Pill, CreditCard, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FORM_TYPE_LABELS } from "@/lib/routes";
import { formatDate } from "@/lib/date";
import type { FormType } from "@/lib/validators/form-data";

type HistoryRecord = {
  id: string;
  type: FormType;
  status: "draft" | "completed";
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown>;
};

type HistoryPayment = {
  id: string;
  amount: string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  evidenceUrl: string | null;
  evidenceName: string | null;
  confirmedBy: string | null;
  confirmedAt: string;
  revertedAt: string | null;
};

const TYPE_ICONS: Record<FormType, typeof Pill> = {
  prescription: Pill,
  lab: FlaskConical,
  medical_report: FileText,
};

/** Prescriptions open in their editor (where the medication chart lives); other forms in the document viewer. */
function recordHref(r: HistoryRecord): string {
  return r.type === "prescription" ? `/prescription/${r.id}` : `/documents/${r.id}`;
}

function recordSummary(r: HistoryRecord): string {
  const d = r.data ?? {};
  if (r.type === "prescription") {
    const items = (d.items as { drugName?: string; strength?: string }[] | undefined) ?? [];
    return items
      .filter((i) => i.drugName?.trim())
      .map((i) => [i.drugName, i.strength].filter(Boolean).join(" "))
      .join(", ");
  }
  if (r.type === "lab") {
    const tests = (d.testsSelected as string[] | undefined) ?? [];
    const diagnosis = (d.provisionalDiagnosis as string | undefined) ?? "";
    return [diagnosis, tests.length ? `${tests.length} test${tests.length === 1 ? "" : "s"} requested` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  const sections = d.sections as { diagnosis?: { content?: string } } | undefined;
  return sections?.diagnosis?.content ?? "";
}

function formatNaira(amount: string | null): string {
  if (!amount) return "—";
  const n = Number(amount.replace(/,/g, ""));
  return Number.isFinite(n) ? `₦${n.toLocaleString()}` : `₦${amount}`;
}

/** Fetches a patient's forms (newest first) and payment history. `refreshKey` forces a refetch. */
export function usePatientHistory(patientId: string, refreshKey = 0) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [payments, setPayments] = useState<HistoryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedFor, setLoadedFor] = useState(patientId);

  // Show the spinner again when switching patients, without a synchronous setState in the effect.
  if (loadedFor !== patientId) {
    setLoadedFor(patientId);
    setLoading(true);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/patients/${patientId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        setRecords(data.records ?? []);
        setPayments(data.payments ?? []);
      })
      .catch((err) => console.error("Failed to load patient history:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, refreshKey]);

  return { records, payments, loading };
}

/** Full treatment & payment history, styled for the (always-light) pink case folder. */
export function CaseFileHistory({ patientId, refreshKey }: { patientId: string; refreshKey?: number }) {
  const { records, payments, loading } = usePatientHistory(patientId, refreshKey);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading patient history...
      </div>
    );
  }

  return (
    <div className="border-2 border-pink-400 rounded-lg p-5 bg-pink-100/40 shadow-sm space-y-6 text-xs text-slate-800">
      <div>
        <h3 className="font-bold text-xs uppercase tracking-wider text-pink-950 mb-2">
          TREATMENT RECORDS ({records.length})
        </h3>
        <div className="overflow-x-auto border border-pink-300 rounded bg-white">
          <table className="w-full min-w-[560px] text-left text-[11px]">
            <thead className="bg-pink-100 text-pink-950 font-bold border-b border-pink-300">
              <tr>
                <th className="p-2 w-24">Date</th>
                <th className="p-2 w-32">Form</th>
                <th className="p-2">Details</th>
                <th className="p-2 w-24">Status</th>
                <th className="p-2 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-200">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                    No prescriptions, lab requests or medical reports yet
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const Icon = TYPE_ICONS[r.type];
                  return (
                    <tr key={r.id}>
                      <td className="p-2 font-medium whitespace-nowrap">{formatDate(r.createdAt)}</td>
                      <td className="p-2">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <Icon className="h-3.5 w-3.5 text-pink-700" /> {FORM_TYPE_LABELS[r.type]}
                        </span>
                      </td>
                      <td className="p-2 text-slate-700">{recordSummary(r) || "—"}</td>
                      <td className="p-2">
                        <Badge variant={r.status === "completed" ? "completed" : "secondary"} className="text-[10px]">
                          {r.status === "completed" ? "Completed" : "Draft"}
                        </Badge>
                      </td>
                      <td className="p-2 text-right">
                        <Link href={recordHref(r)} className="inline-flex items-center gap-1 font-semibold text-pink-800 hover:underline">
                          Open <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="font-bold text-xs uppercase tracking-wider text-pink-950 mb-2 flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" /> PAYMENT HISTORY ({payments.length})
        </h3>
        <div className="overflow-x-auto border border-pink-300 rounded bg-white">
          <table className="w-full min-w-[560px] text-left text-[11px]">
            <thead className="bg-pink-100 text-pink-950 font-bold border-b border-pink-300">
              <tr>
                <th className="p-2 w-24">Date</th>
                <th className="p-2 w-24">Amount</th>
                <th className="p-2">Method / Reference</th>
                <th className="p-2">Cleared By</th>
                <th className="p-2 w-20">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-200">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                    No payments recorded
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className={p.revertedAt ? "text-slate-400" : ""}>
                    <td className="p-2 font-medium whitespace-nowrap">{formatDate(p.confirmedAt)}</td>
                    <td className={`p-2 font-mono font-bold ${p.revertedAt ? "line-through" : "text-emerald-700"}`}>
                      {formatNaira(p.amount)}
                    </td>
                    <td className="p-2">
                      {[p.method, p.reference].filter(Boolean).join(" · ") || "—"}
                      {p.notes ? <span className="block text-slate-500">{p.notes}</span> : null}
                      {p.revertedAt ? (
                        <span className="block font-semibold text-rose-600">Reverted {formatDate(p.revertedAt)}</span>
                      ) : null}
                    </td>
                    <td className="p-2">{p.confirmedBy || "—"}</td>
                    <td className="p-2">
                      {p.evidenceUrl ? (
                        <a href={p.evidenceUrl} target="_blank" rel="noreferrer" className="font-semibold text-pink-800 hover:underline">
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Compact "most recent forms" list for the Patients page side panel (theme-aware). */
export function RecentRecordsList({ patientId, limit = 4 }: { patientId: string; limit?: number }) {
  const { records, loading } = usePatientHistory(patientId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading records...
      </div>
    );
  }
  if (records.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No prescriptions, lab requests or reports yet.</p>;
  }

  return (
    <div className="space-y-2">
      {records.slice(0, limit).map((r) => {
        const Icon = TYPE_ICONS[r.type];
        const summary = recordSummary(r);
        return (
          <Link
            key={r.id}
            href={recordHref(r)}
            className="block rounded-xl bg-muted/40 p-2.5 border border-border/60 hover:bg-muted/70 transition-colors"
          >
            <p className="font-bold text-foreground flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0 text-brand-green" /> {FORM_TYPE_LABELS[r.type]}
              {r.status === "draft" ? <span className="text-[10px] font-semibold text-muted-foreground">(draft)</span> : null}
            </p>
            {summary ? <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{summary}</p> : null}
            <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(r.createdAt)}</p>
          </Link>
        );
      })}
      {records.length > limit ? (
        <p className="text-[11px] text-muted-foreground">
          +{records.length - limit} more in the full case file
        </p>
      ) : null}
    </div>
  );
}
