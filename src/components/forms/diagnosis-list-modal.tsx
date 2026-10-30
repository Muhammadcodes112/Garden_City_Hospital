"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Search,
  Save,
  X,
  Trash2,
  Plus,
  Clock,
  Sparkles,
  Stethoscope,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { COMMON_DIAGNOSES, COMMON_EXAMINATION_FINDINGS } from "@/lib/clinical-diagnoses";
import {
  getClinicalHistory,
  getDeletedItems,
  removeFromClinicalHistory,
  saveToClinicalHistory,
  subscribeClinicalHistory,
} from "@/lib/clinical-history-storage";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (selectedItems: string[]) => void;
  mode?: "all" | "diagnosis" | "findings";
  title?: string;
};

type ItemType = "diagnosis" | "history" | "finding";

type ClinicalItem = {
  text: string;
  type: ItemType;
  isCustom?: boolean;
};

export function DiagnosisListModal({
  open,
  onOpenChange,
  onSelect,
  mode = "all",
  title = "Filter diagnosis List",
}: Props) {
  const [search, setSearch] = useState("");
  const [historyItems, setHistoryItems] = useState<string[]>([]);
  const [deletedItems, setDeletedItems] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"all" | "diagnosis" | "history" | "finding">(
    mode === "findings" ? "finding" : "diagnosis"
  );
  const [newCustomText, setNewCustomText] = useState("");

  // Sync client-side history on mount and on storage events
  useEffect(() => {
    function refresh() {
      setHistoryItems(getClinicalHistory());
      setDeletedItems(getDeletedItems());
    }
    refresh();

    // Also fetch past diagnoses from DB to enrich history on first load
    fetch("/api/clinical/history")
      .then((res) => (res.ok ? res.json() : { history: [] }))
      .then((data) => {
        if (Array.isArray(data.history) && data.history.length > 0) {
          for (const item of data.history) {
            saveToClinicalHistory(item);
          }
          refresh();
        }
      })
      .catch((err) => console.error("Could not fetch remote clinical history:", err));

    return subscribeClinicalHistory(refresh);
  }, []);

  // Reset search and selections when opening
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelected(new Set());
      setNewCustomText("");
    }
  }, [open]);

  // Combined item list with duplicates removed
  const allItems = useMemo(() => {
    const list: ClinicalItem[] = [];
    const seen = new Set<string>();

    // 1. Doctor's History (highest priority)
    for (const h of historyItems) {
      const lower = h.toLowerCase().trim();
      if (!seen.has(lower) && !deletedItems.has(lower)) {
        seen.add(lower);
        list.push({ text: h, type: "history", isCustom: true });
      }
    }

    // 2. Standard Diagnoses (from user's list)
    if (mode === "all" || mode === "diagnosis") {
      for (const d of COMMON_DIAGNOSES) {
        const lower = d.toLowerCase().trim();
        if (!seen.has(lower) && !deletedItems.has(lower)) {
          seen.add(lower);
          list.push({ text: d, type: "diagnosis" });
        }
      }
    }

    // 3. Examination Findings
    if (mode === "all" || mode === "findings") {
      for (const f of COMMON_EXAMINATION_FINDINGS) {
        const lower = f.toLowerCase().trim();
        if (!seen.has(lower) && !deletedItems.has(lower)) {
          seen.add(lower);
          list.push({ text: f, type: "finding" });
        }
      }
    }

    return list;
  }, [historyItems, deletedItems, mode]);

  // Filter by tab and search query
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allItems.filter((item) => {
      // Tab filter
      if (activeTab === "diagnosis" && item.type !== "diagnosis" && !(item.type === "history" && !COMMON_EXAMINATION_FINDINGS.includes(item.text))) {
        return false;
      }
      if (activeTab === "history" && item.type !== "history") {
        return false;
      }
      if (activeTab === "finding" && item.type !== "finding") {
        return false;
      }

      // Query filter
      if (!q) return true;
      return item.text.toLowerCase().includes(q);
    });
  }, [allItems, activeTab, search]);

  function toggleItem(text: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(text)) next.delete(text);
      else next.add(text);
      return next;
    });
  }

  function handleAddCustom() {
    const text = newCustomText.trim();
    if (!text) return;
    saveToClinicalHistory(text);
    setSelected((prev) => new Set(prev).add(text));
    setNewCustomText("");
    toast.success(`"${text}" added and saved to history`);
  }

  function handleDeleteItem(itemText: string) {
    removeFromClinicalHistory(itemText);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(itemText);
      return next;
    });
    toast.info(`"${itemText}" removed from list`);
  }

  function handleSaveAndBack() {
    if (selected.size === 0) {
      toast.info("No items selected. Pick one or more items to insert.");
      return;
    }
    const selectedArray = Array.from(selected);
    // Also save selected items to doctor history so they bubble up for future use
    for (const item of selectedArray) {
      saveToClinicalHistory(item);
    }
    onSelect(selectedArray);
    onOpenChange(false);
  }

  function handleClearSelection() {
    setSelected(new Set());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-xl flex-col p-0 overflow-hidden sm:rounded-2xl">
        {/* HEADER: Filter diagnosis List style */}
        <DialogHeader className="border-b border-border bg-muted/40 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold text-foreground">
                {title}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Tap items to select. Everything typed is saved to your history for later use.
              </p>
            </div>
            {selected.size > 0 && (
              <Badge variant="secondary" className="font-mono text-xs">
                {selected.size} selected
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* SEARCH AND FILTER BAR */}
        <div className="space-y-2 border-b border-border bg-background p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter diagnosis list..."
              className="h-11 pl-9 pr-8 text-sm"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear filter"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* TABS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("diagnosis")}
              className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                activeTab === "diagnosis"
                  ? "bg-emerald-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <Stethoscope className="h-3.5 w-3.5" /> Diagnoses ({COMMON_DIAGNOSES.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                activeTab === "history"
                  ? "bg-emerald-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <Clock className="h-3.5 w-3.5" /> Doctor History ({historyItems.length})
            </button>
            {mode !== "diagnosis" && (
              <button
                type="button"
                onClick={() => setActiveTab("finding")}
                className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                  activeTab === "finding"
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <Activity className="h-3.5 w-3.5" /> Findings ({COMMON_EXAMINATION_FINDINGS.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-emerald-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              All ({allItems.length})
            </button>
          </div>

          {/* ADD CUSTOM DIAGNOSIS INPUT */}
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={newCustomText}
              onChange={(e) => setNewCustomText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
              placeholder="Type new diagnosis/finding to add..."
              className="h-9 text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddCustom}
              disabled={!newCustomText.trim()}
              className="h-9 shrink-0 gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>

        {/* SUBTITLE NOTIFICATION BANNER (from screenshot: "long press to Edit items") */}
        <div className="bg-sky-50 dark:bg-sky-950/40 px-4 py-1.5 text-[11px] font-medium text-sky-800 dark:text-sky-200 border-b border-sky-100 dark:border-sky-900/50 flex items-center justify-between">
          <span>Tap checkbox or row to select. Custom items have a trash icon to delete.</span>
          <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400">
            {filteredItems.length} items
          </span>
        </div>

        {/* LIST OF DIAGNOSES */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <p>No diagnosis matching &quot;{search}&quot;</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewCustomText(search);
                  handleAddCustom();
                }}
                className="mt-3 gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Add &quot;{search}&quot; to list
              </Button>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isChecked = selected.has(item.text);
              return (
                <div
                  key={item.text}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-colors cursor-pointer hover:bg-muted/60 ${
                    isChecked ? "bg-emerald-50/70 dark:bg-emerald-950/20" : ""
                  }`}
                  onClick={() => toggleItem(item.text)}
                >
                  <label
                    className="flex flex-1 items-center gap-3 cursor-pointer select-none min-w-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleItem(item.text)}
                      className="h-5 w-5 rounded border-slate-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                    <span
                      className={`text-sm leading-snug font-medium truncate ${
                        isChecked ? "text-emerald-900 dark:text-emerald-300 font-semibold" : "text-foreground"
                      }`}
                    >
                      {item.text}
                    </span>
                  </label>

                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {item.isCustom ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-5 px-1.5 text-sky-700 bg-sky-50 dark:bg-sky-950/40 border-sky-300 gap-1"
                      >
                        <Clock className="h-2.5 w-2.5" /> History
                      </Badge>
                    ) : item.type === "finding" ? (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 text-muted-foreground">
                        Finding
                      </Badge>
                    ) : null}

                    {item.isCustom ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        title="Delete from history"
                        onClick={() => handleDeleteItem(item.text)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* BOTTOM ACTION BAR (from screenshots: "Delete Item" left, "Save & Back" right) */}
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border bg-card">
          <button
            type="button"
            onClick={handleClearSelection}
            disabled={selected.size === 0}
            className="flex h-14 items-center justify-center gap-2 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="h-4 w-4" /> Clear Selection
          </button>
          <button
            type="button"
            onClick={handleSaveAndBack}
            className="flex h-14 items-center justify-center gap-2 bg-emerald-600 text-sm font-bold text-white transition-colors hover:bg-emerald-700 active:bg-emerald-800"
          >
            <Save className="h-4 w-4" /> Save & Back {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
