"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Command, X, FlaskConical, Pill, FileText, Loader2, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FORM_ROUTES, FORM_TYPE_LABELS } from "@/lib/routes";
import type { SearchResultRecord } from "@/lib/search";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Keyboard shortcut listener: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounced search fetch
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/records/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.items || []);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, open]);

  const handleSelectRecord = (type: keyof typeof FORM_ROUTES, recordId: string) => {
    setOpen(false);
    const baseHref = FORM_ROUTES[type];
    router.push(`${baseHref}?recordId=${recordId}`);
  };

  const labResults = results.filter((r) => r.type === "lab");
  const prescriptionResults = results.filter((r) => r.type === "prescription");
  const medicalReportResults = results.filter((r) => r.type === "medical_report");

  return (
    <>
      {/* Desktop Header Search Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs w-64 justify-between transition-colors shadow-xs"
      >
        <span className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5" />
          <span>Search records...</span>
        </span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Mobile Header Search Trigger Icon */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="lg:hidden h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Search records"
      >
        <Search className="h-4 w-4" />
      </Button>

      {/* Search Command Palette Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <DialogTitle className="sr-only">Search Medical Records</DialogTitle>
          
          {/* Search Input Bar */}
          <div className="flex items-center border-b border-border px-4 py-3 gap-3 bg-muted/20">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patient name, hospital no., prescriber, drugs, diagnosis..."
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-8 text-sm placeholder:text-muted-foreground/70 bg-transparent"
              autoFocus
            />
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-brand-green shrink-0" />}
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
            {results.length === 0 && !isLoading && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground">No records found</p>
                <p className="text-xs mt-1">Try searching by patient surname, hospital number (e.g. GCSH/2026/008), or diagnosis.</p>
              </div>
            )}

            {/* Lab Requests Group */}
            {labResults.length > 0 && (
              <ResultGroup
                title="Laboratory Request Forms"
                icon={FlaskConical}
                items={labResults}
                onSelect={handleSelectRecord}
              />
            )}

            {/* Prescriptions Group */}
            {prescriptionResults.length > 0 && (
              <ResultGroup
                title="Prescription Forms"
                icon={Pill}
                items={prescriptionResults}
                onSelect={handleSelectRecord}
              />
            )}

            {/* Medical Reports Group */}
            {medicalReportResults.length > 0 && (
              <ResultGroup
                title="Medical Reports"
                icon={FileText}
                items={medicalReportResults}
                onSelect={handleSelectRecord}
              />
            )}
          </div>

          {/* Footer Bar */}
          <div className="border-t border-border px-4 py-2 bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
            <span>Found {results.length} record{results.length === 1 ? "" : "s"}</span>
            <div className="flex items-center gap-3">
              <span>Press <kbd className="px-1 py-0.5 rounded bg-background border border-border">ESC</kbd> to close</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResultGroup({
  title,
  icon: Icon,
  items,
  onSelect,
}: {
  title: string;
  icon: any;
  items: SearchResultRecord[];
  onSelect: (type: keyof typeof FORM_ROUTES, id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5 text-brand-green" />
        <span>{title}</span>
        <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div className="mt-1 space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.type, item.id)}
            className="w-full text-left p-2.5 rounded-lg hover:bg-muted/60 transition-colors flex items-center justify-between group border border-transparent hover:border-border"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground truncate">
                  {item.patient.surname}, {item.patient.firstNames}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {item.patient.hospitalNumber}
                </span>
                <Badge
                  variant={item.status === "completed" ? "default" : "secondary"}
                  className={item.status === "completed" ? "bg-emerald-600 text-white text-[10px]" : "text-[10px]"}
                >
                  {item.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {item.summarySnippet}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-3 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
