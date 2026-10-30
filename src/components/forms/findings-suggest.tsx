"use client";

import { useEffect, useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListPlus, Stethoscope, Clock, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { COMMON_DIAGNOSES, COMMON_EXAMINATION_FINDINGS } from "@/lib/clinical-diagnoses";
import {
  getClinicalHistory,
  saveToClinicalHistory,
  subscribeClinicalHistory,
} from "@/lib/clinical-history-storage";
import { DiagnosisListModal } from "@/components/forms/diagnosis-list-modal";

export { COMMON_EXAMINATION_FINDINGS };

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  suggestions?: string[];
  className?: string;
  mode?: "all" | "diagnosis" | "findings";
  label?: string;
};

export function FindingsSuggestField({
  value,
  onChange,
  disabled,
  placeholder,
  rows = 3,
  suggestions,
  className,
  mode = "all",
  label,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [savedNotice, setSavedNotice] = useState(false);

  // Sync doctor history
  useEffect(() => {
    function refresh() {
      setHistory(getClinicalHistory());
    }
    refresh();
    return subscribeClinicalHistory(refresh);
  }, []);

  // Quick chips: top 5 items from doctor history, or top common diagnoses
  const quickChips = useMemo(() => {
    const list: string[] = [];
    // Prioritize doctor's recent history
    for (const h of history) {
      if (!list.includes(h)) list.push(h);
      if (list.length >= 6) break;
    }
    // Fill with top conditions if history is empty
    if (list.length < 5) {
      const fallback =
        mode === "findings"
          ? COMMON_EXAMINATION_FINDINGS
          : ["Hypertension", "Diabetes Mellitus", "Acute Malaria", "Peptic Ulcer", "Asthma", "Enteric Fever (Typhoid)"];
      for (const item of fallback) {
        if (!list.includes(item)) list.push(item);
        if (list.length >= 6) break;
      }
    }
    return list;
  }, [history, mode]);

  // Combined suggestions for inline dropdown
  const inlineSuggestions = useMemo(() => {
    if (suggestions && suggestions.length > 0) return suggestions;
    if (mode === "findings") return [...COMMON_EXAMINATION_FINDINGS];
    if (mode === "diagnosis") return [...history.slice(0, 8), ...COMMON_DIAGNOSES];
    return [...history.slice(0, 6), ...COMMON_DIAGNOSES.slice(0, 15), ...COMMON_EXAMINATION_FINDINGS.slice(0, 10)];
  }, [suggestions, mode, history]);

  function insertOne(text: string) {
    const trimmed = value.trim();
    const needsSeparator = trimmed.length > 0 && !/[.,;]\s*$/.test(trimmed);
    const next = trimmed ? `${trimmed}${needsSeparator ? ", " : " "}${text}` : text;
    onChange(next);
    saveToClinicalHistory(text);
    setOpenDropdown(false);
  }

  function insertMultiple(items: string[]) {
    if (items.length === 0) return;
    const trimmed = value.trim();
    const needsSeparator = trimmed.length > 0 && !/[.,;]\s*$/.test(trimmed);
    const joined = items.join(", ");
    const next = trimmed ? `${trimmed}${needsSeparator ? ", " : " "}${joined}` : joined;
    onChange(next);
    for (const it of items) {
      saveToClinicalHistory(it);
    }
    toast.success(`${items.length} ${items.length === 1 ? "item" : "items"} inserted & saved to history`);
  }

  function handleBlur() {
    if (value.trim()) {
      saveToClinicalHistory(value);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    }
  }

  return (
    <div className="relative space-y-1.5">
      {/* ACTION TOOLBAR: BROWSE LIST + QUICK CHIPS */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7.5 gap-1.5 bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-xs font-semibold"
            disabled={disabled}
            onClick={() => setModalOpen(true)}
          >
            <Stethoscope className="h-3.5 w-3.5 text-emerald-600" />
            {mode === "diagnosis"
              ? "Filter diagnosis List"
              : mode === "findings"
              ? "Examination Findings List"
              : "Diagnosis & Clinical Notes List"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            disabled={disabled}
            onClick={() => setOpenDropdown((o) => !o)}
          >
            <ListPlus className="mr-1 h-3.5 w-3.5" /> Quick suggestions
          </Button>
        </div>

        {savedNotice && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <Check className="h-3 w-3" /> Saved to history
          </span>
        )}
      </div>

      {/* QUICK ONE-TAP PILLS */}
      {!disabled && quickChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
            Quick add:
          </span>
          {quickChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => insertOne(chip)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-emerald-100 hover:border-emerald-400 hover:text-emerald-900 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300"
            >
              <Plus className="h-2.5 w-2.5 text-muted-foreground" />
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* TEXTAREA WITH AUTO-SAVE ON BLUR */}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={className}
      />

      {/* INLINE AUTOCOMPLETE DROPDOWN */}
      {openDropdown ? (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-popover py-1 text-xs shadow-lg text-popover-foreground">
          {inlineSuggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertOne(s);
                }}
              >
                <span>{s}</span>
                {history.includes(s) && (
                  <Badge variant="secondary" className="text-[9px] h-4 text-sky-700 bg-sky-50 dark:bg-sky-950/40">
                    <Clock className="mr-0.5 h-2 w-2" /> History
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* FULL DIAGNOSIS SELECTION MODAL */}
      <DiagnosisListModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSelect={insertMultiple}
        mode={mode}
        title={
          mode === "diagnosis"
            ? "Filter diagnosis List"
            : mode === "findings"
            ? "Filter Examination Findings"
            : "Filter diagnosis & Clinical Notes"
        }
      />
    </div>
  );
}
