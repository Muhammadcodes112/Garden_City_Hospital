"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, FlaskConical, Loader2, Pill, CreditCard, ExternalLink, Activity, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { recordVitals } from "@/lib/actions/vitals";
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

type HistoryVitals = {
  id: string;
  bloodPressure: string | null;
  pulse: number | null;
  temperature: string | null;
  spo2: number | null;
  notes: string | null;
  recordedByName: string;
  recordedAt: string;
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDate(d)} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

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
  const [vitals, setVitals] = useState<HistoryVitals[]>([]);
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
        setVitals(data.vitals ?? []);
      })
      .catch((err) => console.error("Failed to load patient history:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, refreshKey]);

  return { records, payments, vitals, loading };
}

/** Full treatment & payment history, styled for the (always-light) pink case folder. */
export function CaseFileHistory({ patientId, refreshKey }: { patientId: string; refreshKey?: number }) {
  const { records, payments, vitals, loading } = usePatientHistory(patientId, refreshKey);

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
          <Activity className="h-3.5 w-3.5" /> VITAL SIGNS ({vitals.length})
        </h3>
        <div className="overflow-x-auto border border-pink-300 rounded bg-white">
          <table className="w-full min-w-[560px] text-left text-[11px]">
            <thead className="bg-pink-100 text-pink-950 font-bold border-b border-pink-300">
              <tr>
                <th className="p-2 w-32">Date / Time</th>
                <th className="p-2">BP</th>
                <th className="p-2">Pulse</th>
                <th className="p-2">Temp</th>
                <th className="p-2">SpO₂</th>
                <th className="p-2">Notes</th>
                <th className="p-2">Taken By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-200">
              {vitals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-3 text-center text-slate-400 italic">
                    No vitals recorded. Use &quot;Record vitals&quot; on the Patients page.
                  </td>
                </tr>
              ) : (
                vitals.map((v) => (
                  <tr key={v.id}>
                    <td className="p-2 font-medium whitespace-nowrap">{formatDateTime(v.recordedAt)}</td>
                    <td className="p-2 font-mono">{v.bloodPressure ?? "—"}</td>
                    <td className="p-2 font-mono">{v.pulse != null ? `${v.pulse} bpm` : "—"}</td>
                    <td className="p-2 font-mono">{v.temperature ? `${v.temperature}°C` : "—"}</td>
                    <td className="p-2 font-mono">{v.spo2 != null ? `${v.spo2}%` : "—"}</td>
                    <td className="p-2 text-slate-600">{v.notes || "—"}</td>
                    <td className="p-2">{v.recordedByName}</td>
                  </tr>
                ))
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

const EMPTY_VITALS_FORM = { bloodPressure: "", pulse: "", temperature: "", spo2: "", notes: "" };

/** Latest vital signs + "Record vitals" for the Patients page side panel (theme-aware). */
export function PatientVitals({ patientId }: { patientId: string }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { vitals, loading } = usePatientHistory(patientId, refreshKey);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_VITALS_FORM);
  const [saving, setSaving] = useState(false);
  const latest = vitals[0];

  const tiles = [
    { label: "BP", value: latest?.bloodPressure },
    { label: "Pulse", value: latest?.pulse != null ? `${latest.pulse} bpm` : null },
    { label: "Temp", value: latest?.temperature ? `${latest.temperature}°C` : null },
    { label: "SpO₂", value: latest?.spo2 != null ? `${latest.spo2}%` : null },
  ];

  async function handleSave() {
    setSaving(true);
    try {
      const res = await recordVitals({ patientId, ...form });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Vitals recorded");
      setOpen(false);
      setForm(EMPTY_VITALS_FORM);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to record vitals:", err);
      toast.error("Failed to record vitals");
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof typeof EMPTY_VITALS_FORM, label: string, placeholder: string, inputMode?: "numeric" | "decimal") => (
    <div className="space-y-1">
      <Label htmlFor={`vitals-${key}`} className="text-xs">{label}</Label>
      <Input
        id={`vitals-${key}`}
        inputMode={inputMode}
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-bold text-foreground">Latest Vitals</span>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} className="h-7 gap-1 px-2 text-[11px] font-semibold rounded-lg">
          <Plus className="h-3 w-3" /> Record vitals
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading vitals...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 text-center">
            {tiles.map((t) => (
              <div
                key={t.label}
                className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-2.5 border border-slate-200 dark:border-slate-800 shadow-2xs"
              >
                <span className="text-[10px] text-muted-foreground font-bold block uppercase tracking-wider">{t.label}</span>
                <span className="font-black text-xs text-foreground mt-0.5 block">{t.value ?? "—"}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {latest ? `Taken ${formatDateTime(latest.recordedAt)} by ${latest.recordedByName}` : "No vitals recorded yet."}
          </p>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Record Vitals
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Fill in what you measured and leave the rest blank. Each reading is kept with your name and the time.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {field("bloodPressure", "Blood pressure (mmHg)", "120/80")}
            {field("pulse", "Pulse (bpm)", "72", "numeric")}
            {field("temperature", "Temperature (°C)", "36.8", "decimal")}
            {field("spo2", "SpO₂ (%)", "98", "numeric")}
          </div>
          {field("notes", "Notes (optional)", "e.g. patient febrile, taken after walking")}
          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={handleSave} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
