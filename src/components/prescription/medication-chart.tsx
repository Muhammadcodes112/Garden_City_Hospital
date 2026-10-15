"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardCheck, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearDose, getDoseEntries, recordDose, type DoseEntry } from "@/lib/actions/medication-chart";
import { DOSE_SLOTS, doseItemKey, type DoseSlot } from "@/lib/validators/medication-chart";
import type { PrescriptionItem } from "@/lib/validators/prescription";
import { formatDate } from "@/lib/date";

const SLOT_LABELS: Record<DoseSlot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toIsoDate(new Date(y!, m! - 1, d! + days));
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type Editing = { itemId: string; drugLabel: string; slot: DoseSlot; existing: DoseEntry | undefined };

export function MedicationChart({ recordId, items }: { recordId: string; items: PrescriptionItem[] }) {
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [entries, setEntries] = useState<DoseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [given, setGiven] = useState(true);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const drugs = items
    .map((item, i) => ({ item, key: doseItemKey(item, i) }))
    .filter(({ item }) => item.drugName.trim());

  useEffect(() => {
    let cancelled = false;
    getDoseEntries(recordId, date)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((err) => {
        console.error("Failed to load medication chart:", err);
        toast.error("Failed to load medication chart");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recordId, date, reloadKey]);

  function changeDate(next: string) {
    setLoading(true);
    setDate(next);
  }

  if (drugs.length === 0) return null;

  const entryFor = (itemId: string, slot: DoseSlot) => entries.find((e) => e.itemId === itemId && e.slot === slot);

  function openCell(itemId: string, drugLabel: string, slot: DoseSlot) {
    const existing = entryFor(itemId, slot);
    setEditing({ itemId, drugLabel, slot, existing });
    setGiven(existing ? existing.given : true);
    setReason(existing?.reason ?? "");
  }

  async function handleSave() {
    if (!editing) return;
    if (!given && !reason.trim()) {
      toast.error("State the reason the dose was not given");
      return;
    }
    setSaving(true);
    try {
      const res = await recordDose({
        formRecordId: recordId,
        itemId: editing.itemId,
        date,
        slot: editing.slot,
        given,
        reason: given ? undefined : reason.trim(),
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setEditing(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to chart dose:", err);
      toast.error("Failed to save entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!editing) return;
    setSaving(true);
    try {
      await clearDose({ formRecordId: recordId, itemId: editing.itemId, date, slot: editing.slot });
      setEditing(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to clear dose:", err);
      toast.error("Failed to clear entry");
    } finally {
      setSaving(false);
    }
  }

  const isToday = date === toIsoDate(new Date());

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <ClipboardCheck className="h-5 w-5 text-brand-green" /> Medication Administration Chart
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Tick each dose when it is given. If a dose is not given, state why so the next shift knows.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => changeDate(shiftDate(date, -1))} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(e) => e.target.value && changeDate(e.target.value)}
            className="h-8 w-[150px] text-xs"
            aria-label="Chart date"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => changeDate(shiftDate(date, 1))} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday ? (
            <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => changeDate(toIsoDate(new Date()))}>
              Today
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-muted/50 border-b border-border font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3 min-w-[180px]">Medication · {formatDate(date)}</th>
                {DOSE_SLOTS.map((slot) => (
                  <th key={slot} className="py-3 px-2 text-center">{SLOT_LABELS[slot]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {drugs.map(({ item, key }) => {
                const drugLabel = [item.drugName, item.strength].filter(Boolean).join(" ");
                return (
                  <tr key={key}>
                    <td className="py-3 px-3 align-top">
                      <p className="font-semibold text-foreground">{drugLabel}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {[item.dose, item.route, item.frequency].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    {DOSE_SLOTS.map((slot) => {
                      const entry = entryFor(key, slot);
                      return (
                        <td key={slot} className="py-2 px-2 align-top">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => openCell(key, drugLabel, slot)}
                            className={`w-full min-h-[52px] rounded-md border px-2 py-1.5 text-left transition-colors disabled:opacity-50 ${
                              !entry
                                ? "border-dashed border-border text-muted-foreground hover:bg-muted/40 text-center"
                                : entry.given
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                            }`}
                          >
                            {!entry ? (
                              <span className="text-[11px]">Not charted</span>
                            ) : (
                              <>
                                <span className="flex items-center gap-1 font-semibold">
                                  {entry.given ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                  {entry.given ? "Given" : "Not given"}
                                </span>
                                {!entry.given && entry.reason ? (
                                  <span className="block text-[11px] leading-snug mt-0.5">{entry.reason}</span>
                                ) : null}
                                <span className="block text-[10px] opacity-75 mt-0.5">
                                  {entry.recordedByName} · {formatTime(entry.recordedAt)}
                                </span>
                              </>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.drugLabel}</DialogTitle>
            <DialogDescription className="text-xs pt-1">
              {editing ? `${SLOT_LABELS[editing.slot]} dose · ${formatDate(date)}` : null}
              {editing?.existing
                ? ` · last charted by ${editing.existing.recordedByName} at ${formatTime(editing.existing.recordedAt)}`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={given ? "default" : "outline"} onClick={() => setGiven(true)} className="gap-1.5">
                <Check className="h-4 w-4" /> Given
              </Button>
              <Button
                type="button"
                variant={given ? "outline" : "destructive"}
                onClick={() => setGiven(false)}
                className="gap-1.5"
              >
                <X className="h-4 w-4" /> Not given
              </Button>
            </div>
            {!given ? (
              <div>
                <Label htmlFor="dose-reason">Reason not given (required)</Label>
                <Textarea
                  id="dose-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Patient refused; drug out of stock; patient NPO for surgery; held due to low BP"
                  rows={3}
                  className="mt-1"
                />
              </div>
            ) : null}
          </div>
          <DialogFooter className="pt-2 gap-2">
            {editing?.existing ? (
              <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={handleClear} className="sm:mr-auto">
                Clear entry
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={handleSave} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
