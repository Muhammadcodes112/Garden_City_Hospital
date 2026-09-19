"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PatientPicker, type PatientFields } from "@/components/lab/patient-picker";
import { SignaturePad } from "@/components/forms/signature-pad";
import { SaveStatus } from "@/components/forms/save-status";
import { PdfPreviewDialog } from "@/components/forms/pdf-preview-dialog";
import { useFormAutosave } from "@/hooks/use-form-autosave";
import {
  completeLabForm,
  saveLabForm,
  type LabFormBundle,
} from "@/lib/actions/lab-form";
import type { LabRequestData } from "@/lib/validators/lab-request";
import {
  ALL_LAB_TESTS,
  LAB_TEST_BY_ID,
  LAB_UI_SECTIONS,
  type LabUiSection,
} from "@/lib/lab-tests/catalog";
import { labRequestPdfFilename } from "@/lib/pdf-templates/lab-request";
import { cn } from "@/lib/utils";

import { ShareDialog } from "@/components/forms/share-dialog";
import { ActiveShareLinks } from "@/components/forms/active-share-links";
import { logFormDownload, reopenFormRecord } from "@/lib/actions/share";
import { Download, Share2, Unlock } from "lucide-react";

type AutosavePayload = {
  patient: PatientFields;
  data: LabRequestData;
};

type Props = {
  initial: LabFormBundle;
};

export function LabFormEditor({ initial }: Props) {
  const router = useRouter();
  const readOnly = initial.status === "completed";
  const [patient, setPatient] = useState<PatientFields>(initial.patient);
  const [data, setData] = useState<LabRequestData>(initial.data);
  const [testSearch, setTestSearch] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareRefreshKey, setShareRefreshKey] = useState(0);
  const [reopening, setReopening] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [serverUpdatedAt, setServerUpdatedAt] = useState(initial.updatedAt);

  const getPayload = useCallback((): AutosavePayload => ({ patient, data }), [patient, data]);

  const onSave = useCallback(
    async (payload: AutosavePayload) => {
      const result = await saveLabForm({
        recordId: initial.recordId,
        patient: payload.patient,
        data: payload.data,
      });
      setServerUpdatedAt(result.updatedAt);
      return result;
    },
    [initial.recordId],
  );

  const { status, scheduleSave, flushSave, restoreFromLocalIfNewer } = useFormAutosave({
    formType: "lab",
    recordId: initial.recordId,
    enabled: !readOnly,
    getPayload,
    serverUpdatedAt,
    onSave,
  });

  useEffect(() => {
    const restored = restoreFromLocalIfNewer();
    if (restored) {
      setPatient(restored.patient);
      setData(restored.data);
    }
  }, [restoreFromLocalIfNewer]);

  useEffect(() => {
    if (!readOnly) scheduleSave();
  }, [patient, data, readOnly, scheduleSave]);

  const selectedSet = useMemo(() => new Set(data.testsSelected), [data.testsSelected]);

  const selectedTests = useMemo(
    () => data.testsSelected.map((id) => LAB_TEST_BY_ID.get(id)).filter(Boolean),
    [data.testsSelected],
  );

  function toggleTest(id: string, checked: boolean) {
    setData((prev) => {
      const next = new Set(prev.testsSelected);
      if (checked) next.add(id);
      else next.delete(id);
      return { ...prev, testsSelected: [...next] };
    });
  }

  function removeTest(id: string) {
    toggleTest(id, false);
  }

  function sectionSelectedCount(section: LabUiSection) {
    let n = 0;
    for (const t of section.tests) if (selectedSet.has(t.id)) n++;
    for (const sub of section.subsections ?? []) {
      for (const t of sub.tests) if (selectedSet.has(t.id)) n++;
    }
    return n;
  }

  function sectionMatchesSearch(section: LabUiSection, q: string) {
    if (!q) return true;
    const hay = [
      section.title,
      ...section.tests.map((t) => t.label),
      ...(section.subsections?.flatMap((s) => [s.title, ...s.tests.map((t) => t.label)]) ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  }

  const q = testSearch.trim().toLowerCase();

  async function handleComplete() {
    setCompleteError(null);
    await flushSave();
    try {
      await completeLabForm({
        recordId: initial.recordId,
        patient,
        data,
      });
      router.refresh();
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : "Could not complete form");
    }
  }

  async function handleReopen() {
    setReopening(true);
    try {
      await reopenFormRecord(initial.recordId);
      router.refresh();
    } catch (err) {
      console.error("Failed to reopen form:", err);
    } finally {
      setReopening(false);
    }
  }

  const pdfFilename = labRequestPdfFilename(patient, data.formDate);

  function handleDownloadClick() {
    logFormDownload(initial.recordId);
  }

  return (
    <div className="flex flex-col gap-6 pb-24 lg:flex-row lg:items-start lg:gap-8 lg:pb-8">
      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SaveStatus status={status} />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(true)}
            >
              Preview PDF
            </Button>
            {readOnly ? (
              <Button asChild variant="outline">
                <a
                  href={`/api/forms/${initial.recordId}/pdf?download=1`}
                  download={pdfFilename}
                  onClick={handleDownloadClick}
                >
                  <Download className="mr-1.5 h-4 w-4" /> Download PDF
                </a>
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setShareOpen(true)}>
              <Share2 className="mr-1.5 h-4 w-4" /> Share
            </Button>
            {!readOnly ? (
              <Button type="button" onClick={handleComplete}>
                Mark as Completed
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="completed">Completed</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={reopening}
                  onClick={handleReopen}
                  className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Unlock className="h-3.5 w-3.5" /> {reopening ? "Reopening..." : "Edit"}
                </Button>
              </div>
            )}
          </div>
        </div>
        {completeError ? (
          <p className="text-sm text-destructive" role="alert">
            {completeError}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Patient</CardTitle>
          </CardHeader>
          <CardContent>
            <PatientPicker
              patient={patient}
              onPatientChange={setPatient}
              disabled={readOnly}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clinical information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="diagnosis">Provisional diagnosis / clinical information</Label>
              <Textarea
                id="diagnosis"
                value={data.provisionalDiagnosis}
                onChange={(e) => setData((d) => ({ ...d, provisionalDiagnosis: e.target.value }))}
                disabled={readOnly}
                className="mt-1 min-h-[88px]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="collection-date">Time of collection — date</Label>
                <Input
                  id="collection-date"
                  type="date"
                  value={data.collectionDate}
                  onChange={(e) => setData((d) => ({ ...d, collectionDate: e.target.value }))}
                  disabled={readOnly}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="collection-time">Time</Label>
                <Input
                  id="collection-time"
                  type="time"
                  value={data.collectionTime}
                  onChange={(e) => setData((d) => ({ ...d, collectionTime: e.target.value }))}
                  disabled={readOnly}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tests requested</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Search tests across all sections…"
              value={testSearch}
              onChange={(e) => setTestSearch(e.target.value)}
            />
            <div className="space-y-3">
              {LAB_UI_SECTIONS.filter((s) => sectionMatchesSearch(s, q)).map((section) => (
                <TestSectionCard
                  key={section.id}
                  section={section}
                  selectedSet={selectedSet}
                  searchQuery={q}
                  disabled={readOnly}
                  selectedCount={sectionSelectedCount(section)}
                  onToggle={toggleTest}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Referring doctor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ref-doc">Referring doctor</Label>
                <Input
                  id="ref-doc"
                  value={data.referringDoctor}
                  onChange={(e) => setData((d) => ({ ...d, referringDoctor: e.target.value }))}
                  disabled={readOnly}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="ref-phone">Phone no.</Label>
                <Input
                  id="ref-phone"
                  value={data.referringPhone}
                  onChange={(e) => setData((d) => ({ ...d, referringPhone: e.target.value }))}
                  disabled={readOnly}
                  className="mt-1"
                />
              </div>
            </div>
            <SignaturePad
              value={data.doctorSignature}
              onChange={(doctorSignature) => setData((d) => ({ ...d, doctorSignature }))}
              disabled={readOnly}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="hospital">Hospital / clinic</Label>
                <Input
                  id="hospital"
                  value={data.hospitalClinic}
                  onChange={(e) => setData((d) => ({ ...d, hospitalClinic: e.target.value }))}
                  disabled={readOnly}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="form-date">Date</Label>
                <Input
                  id="form-date"
                  type="date"
                  value={data.formDate}
                  onChange={(e) => setData((d) => ({ ...d, formDate: e.target.value }))}
                  disabled={readOnly}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <ActiveShareLinks recordId={initial.recordId} refreshKey={shareRefreshKey} />
      </div>

      <SelectedTestsPanel
        tests={selectedTests}
        onRemove={removeTest}
        disabled={readOnly}
        className="hidden lg:block lg:w-72 lg:shrink-0"
      />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-3 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full">
              Selected tests ({data.testsSelected.length})
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh] bg-card text-foreground">
            <SheetTitle className="mb-4">Selected tests</SheetTitle>
            <SelectedTestsList tests={selectedTests} onRemove={removeTest} disabled={readOnly} />
          </SheetContent>
        </Sheet>
      </div>

      <PdfPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        recordId={initial.recordId}
        filename={pdfFilename}
      />

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        recordId={initial.recordId}
        filename={pdfFilename}
        onLinkCreated={() => setShareRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

function TestSectionCard({
  section,
  selectedSet,
  searchQuery,
  disabled,
  selectedCount,
  onToggle,
}: {
  section: LabUiSection;
  selectedSet: Set<string>;
  searchQuery: string;
  disabled: boolean;
  selectedCount: number;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const [open, setOpen] = useState(selectedCount > 0);

  function testVisible(label: string) {
    return !searchQuery || label.toLowerCase().includes(searchQuery);
  }

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-lg border border-border bg-card"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium">
        <span>{section.title}</span>
        {selectedCount > 0 ? (
          <Badge variant="default" className="bg-primary">
            {selectedCount} selected
          </Badge>
        ) : null}
      </summary>
      <div className="border-t border-border px-4 pb-4 pt-2">
        <TestGrid
          tests={section.tests.filter((t) => testVisible(t.label))}
          selectedSet={selectedSet}
          disabled={disabled}
          onToggle={onToggle}
        />
        {(section.subsections ?? []).map((sub) => (
          <div key={sub.title} className="mt-3">
            <p className="mb-2 text-sm font-semibold underline">{sub.title}</p>
            <TestGrid
              tests={sub.tests.filter((t) => testVisible(t.label))}
              selectedSet={selectedSet}
              disabled={disabled}
              onToggle={onToggle}
            />
          </div>
        ))}
      </div>
    </details>
  );
}

function TestGrid({
  tests,
  selectedSet,
  disabled,
  onToggle,
}: {
  tests: { id: string; label: string }[];
  selectedSet: Set<string>;
  disabled: boolean;
  onToggle: (id: string, checked: boolean) => void;
}) {
  if (tests.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
      {tests.map((test) => (
        <li key={test.id}>
          <label
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-transparent px-2 py-2 hover:bg-muted/60",
              selectedSet.has(test.id) && "border-primary/30 bg-primary/5",
            )}
          >
            <Checkbox
              checked={selectedSet.has(test.id)}
              onCheckedChange={(c) => onToggle(test.id, c === true)}
              disabled={disabled}
              className="mt-0.5 h-5 w-5"
            />
            <span className="text-sm leading-snug">{test.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function SelectedTestsPanel({
  tests,
  onRemove,
  disabled,
  className,
}: {
  tests: ({ id: string; label: string } | undefined)[];
  onRemove: (id: string) => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <aside className={cn("sticky top-20", className)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selected tests</CardTitle>
        </CardHeader>
        <CardContent>
          <SelectedTestsList tests={tests} onRemove={onRemove} disabled={disabled} />
        </CardContent>
      </Card>
    </aside>
  );
}

function SelectedTestsList({
  tests,
  onRemove,
  disabled,
}: {
  tests: ({ id: string; label: string } | undefined)[];
  onRemove: (id: string) => void;
  disabled: boolean;
}) {
  if (tests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No tests selected yet. Tick tests below.</p>
    );
  }
  return (
    <ul className="flex max-h-[60vh] flex-wrap gap-2 overflow-auto">
      {tests.map((t) =>
        t ? (
          <li
            key={t.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 py-1 pl-3 pr-1 text-xs"
          >
            <span className="truncate">{t.label}</span>
            {!disabled ? (
              <button
                type="button"
                className="rounded-full p-1 hover:bg-muted"
                onClick={() => onRemove(t.id)}
                aria-label={`Remove ${t.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </li>
        ) : null,
      )}
    </ul>
  );
}

void ALL_LAB_TESTS;
