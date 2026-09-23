"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowUp, ArrowDown, Pill } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PatientPicker, type PatientFields } from "@/components/lab/patient-picker";
import { SignaturePad } from "@/components/forms/signature-pad";
import { SaveStatus } from "@/components/forms/save-status";
import { PdfPreviewDialog } from "@/components/forms/pdf-preview-dialog";
import { useFormAutosave } from "@/hooks/use-form-autosave";
import {
  completePrescriptionForm,
  getDrugAutocompleteSuggestions,
  savePrescriptionForm,
  type PrescriptionFormBundle,
} from "@/lib/actions/prescription-form";
import {
  DOSAGE_FORMS,
  ROUTES,
  type PrescriptionData,
  type PrescriptionItem,
} from "@/lib/validators/prescription";
import { prescriptionPdfFilename } from "@/lib/pdf-templates/prescription";

import { ShareDialog } from "@/components/forms/share-dialog";
import { ActiveShareLinks } from "@/components/forms/active-share-links";
import { logFormDownload, reopenFormRecord } from "@/lib/actions/share";
import { Download, Share2, Unlock } from "lucide-react";
import { toast } from "sonner";

type AutosavePayload = {
  patient: PatientFields;
  data: PrescriptionData;
};

type Props = {
  initial: PrescriptionFormBundle;
};

export function PrescriptionFormEditor({ initial }: Props) {
  const router = useRouter();
  const readOnly = initial.status === "completed";
  const [patient, setPatient] = useState<PatientFields>(initial.patient);
  const [data, setData] = useState<PrescriptionData>(initial.data);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareRefreshKey, setShareRefreshKey] = useState(0);
  const [reopening, setReopening] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [serverUpdatedAt, setServerUpdatedAt] = useState(initial.updatedAt);

  const getPayload = useCallback((): AutosavePayload => ({ patient, data }), [patient, data]);

  const onSave = useCallback(
    async (payload: AutosavePayload) => {
      const result = await savePrescriptionForm({
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
    formType: "prescription",
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

  function addItem() {
    setData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: crypto.randomUUID(),
          drugName: "",
          strength: "",
          dosageForm: "tablet",
          dose: "",
          route: "oral",
          frequency: "",
          duration: "",
          quantity: "",
          instructions: "",
        },
      ],
    }));
  }

  function removeItem(index: number) {
    setData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  function moveItem(index: number, direction: "up" | "down") {
    const newItems = [...data.items];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newItems.length) return;
    const temp = newItems[index]!;
    newItems[index] = newItems[targetIdx]!;
    newItems[targetIdx] = temp;
    setData((prev) => ({ ...prev, items: newItems }));
  }

  function updateItem(index: number, field: keyof PrescriptionItem, value: string) {
    setData((prev) => {
      const newItems = [...prev.items];
      const item = { ...newItems[index]! };
      (item as Record<string, unknown>)[field] = value;
      newItems[index] = item;
      return { ...prev, items: newItems };
    });
  }

  async function handleComplete() {
    setCompleteError(null);
    await flushSave();
    try {
      const res = await completePrescriptionForm({
        recordId: initial.recordId,
        patient,
        data,
      });
      if (!res.success) {
        setCompleteError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Prescription marked as completed!");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not complete form";
      setCompleteError(msg);
      toast.error(msg);
    }
  }

  async function handleReopen() {
    setReopening(true);
    try {
      await reopenFormRecord(initial.recordId);
      toast.success("Form unlocked for editing");
      router.refresh();
    } catch (err) {
      console.error("Failed to reopen form:", err);
      toast.error("Failed to unlock form");
    } finally {
      setReopening(false);
    }
  }

  const pdfFilename = prescriptionPdfFilename(patient, data.prescriberDate);

  function handleDownloadClick() {
    toast.info("Downloading PDF...");
    logFormDownload(initial.recordId);
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SaveStatus status={status} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
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
          <PatientPicker patient={patient} onPatientChange={setPatient} disabled={readOnly} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" /> Prescribed Medications ({data.items.length})
          </CardTitle>
          {!readOnly ? (
            <Button type="button" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-4 w-4" /> Add Drug
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <th className="p-2 w-8 text-center">#</th>
                  <th className="p-2 min-w-[180px]">Drug Name</th>
                  <th className="p-2 w-24">Strength</th>
                  <th className="p-2 w-28">Form</th>
                  <th className="p-2 w-24">Dose</th>
                  <th className="p-2 w-24">Route</th>
                  <th className="p-2 w-28">Frequency</th>
                  <th className="p-2 w-24">Duration</th>
                  <th className="p-2 w-20">Qty</th>
                  <th className="p-2 min-w-[140px]">Instructions</th>
                  {!readOnly ? <th className="p-2 w-24 text-center">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item, index) => (
                  <tr key={item.id ?? index} className="hover:bg-muted/30">
                    <td className="p-2 text-center font-medium text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="p-2">
                      <DrugInput
                        value={item.drugName}
                        onChange={(val) => updateItem(index, "drugName", val)}
                        disabled={readOnly}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={item.strength}
                        onChange={(e) => updateItem(index, "strength", e.target.value)}
                        placeholder="500mg"
                        disabled={readOnly}
                        className="h-9"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={item.dosageForm}
                        onChange={(e) => updateItem(index, "dosageForm", e.target.value)}
                        disabled={readOnly}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {DOSAGE_FORMS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <Input
                        value={item.dose}
                        onChange={(e) => updateItem(index, "dose", e.target.value)}
                        placeholder="1 cap"
                        disabled={readOnly}
                        className="h-9"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={item.route}
                        onChange={(e) => updateItem(index, "route", e.target.value)}
                        disabled={readOnly}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {ROUTES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <Input
                        value={item.frequency}
                        onChange={(e) => updateItem(index, "frequency", e.target.value)}
                        placeholder="8-hourly / TDS"
                        disabled={readOnly}
                        className="h-9"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={item.duration}
                        onChange={(e) => updateItem(index, "duration", e.target.value)}
                        placeholder="5 days"
                        disabled={readOnly}
                        className="h-9"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", e.target.value)}
                        placeholder="15"
                        disabled={readOnly}
                        className="h-9"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={item.instructions}
                        onChange={(e) => updateItem(index, "instructions", e.target.value)}
                        placeholder="After meals"
                        disabled={readOnly}
                        className="h-9"
                      />
                    </td>
                    {!readOnly ? (
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === 0}
                            onClick={() => moveItem(index, "up")}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === data.items.length - 1}
                            onClick={() => moveItem(index, "down")}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 lg:hidden">
            {data.items.map((item, index) => (
              <div
                key={item.id ?? index}
                className="rounded-lg border border-border p-4 space-y-3 bg-card"
              >
                <div className="flex items-center justify-between font-medium">
                  <span>Drug #{index + 1}</span>
                  {!readOnly ? (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === 0}
                        onClick={() => moveItem(index, "up")}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === data.items.length - 1}
                        onClick={() => moveItem(index, "down")}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div>
                  <Label>Drug Name</Label>
                  <DrugInput
                    value={item.drugName}
                    onChange={(val) => updateItem(index, "drugName", val)}
                    disabled={readOnly}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Strength</Label>
                    <Input
                      value={item.strength}
                      onChange={(e) => updateItem(index, "strength", e.target.value)}
                      placeholder="500mg"
                      disabled={readOnly}
                    />
                  </div>
                  <div>
                    <Label>Form</Label>
                    <select
                      value={item.dosageForm}
                      onChange={(e) => updateItem(index, "dosageForm", e.target.value)}
                      disabled={readOnly}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {DOSAGE_FORMS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Dose</Label>
                    <Input
                      value={item.dose}
                      onChange={(e) => updateItem(index, "dose", e.target.value)}
                      placeholder="1 cap"
                      disabled={readOnly}
                    />
                  </div>
                  <div>
                    <Label>Route</Label>
                    <select
                      value={item.route}
                      onChange={(e) => updateItem(index, "route", e.target.value)}
                      disabled={readOnly}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {ROUTES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Frequency</Label>
                    <Input
                      value={item.frequency}
                      onChange={(e) => updateItem(index, "frequency", e.target.value)}
                      placeholder="8-hourly"
                      disabled={readOnly}
                    />
                  </div>
                  <div>
                    <Label>Duration</Label>
                    <Input
                      value={item.duration}
                      onChange={(e) => updateItem(index, "duration", e.target.value)}
                      placeholder="5 days"
                      disabled={readOnly}
                    />
                  </div>
                  <div>
                    <Label>Qty</Label>
                    <Input
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                      placeholder="15"
                      disabled={readOnly}
                    />
                  </div>
                </div>
                <div>
                  <Label>Instructions</Label>
                  <Input
                    value={item.instructions}
                    onChange={(e) => updateItem(index, "instructions", e.target.value)}
                    placeholder="Take after meals"
                    disabled={readOnly}
                  />
                </div>
              </div>
            ))}
          </div>

          {!readOnly ? (
            <Button type="button" variant="outline" className="w-full" onClick={addItem}>
              <Plus className="mr-1 h-4 w-4" /> Add Another Medication
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signatures & Authorization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 border-b border-border pb-4">
            <h4 className="font-semibold text-sm">Prescriber Details</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="prescriber-name">Prescriber's Name</Label>
                <Input
                  id="prescriber-name"
                  value={data.prescriberName}
                  onChange={(e) => setData((d) => ({ ...d, prescriberName: e.target.value }))}
                  disabled={readOnly}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="prescriber-date">Date</Label>
                <Input
                  id="prescriber-date"
                  type="date"
                  value={data.prescriberDate}
                  onChange={(e) => setData((d) => ({ ...d, prescriberDate: e.target.value }))}
                  disabled={readOnly}
                  className="mt-1"
                />
              </div>
            </div>
            <SignaturePad
              value={data.prescriberSignature}
              onChange={(sig) => setData((d) => ({ ...d, prescriberSignature: sig }))}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Pharmacist Details (Optional)</h4>
              <span className="text-xs text-muted-foreground">
                Often signed manually at dispensing
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pharmacist-name">Pharmacist's Name</Label>
                <Input
                  id="pharmacist-name"
                  value={data.pharmacistName}
                  onChange={(e) => setData((d) => ({ ...d, pharmacistName: e.target.value }))}
                  disabled={readOnly}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="pharmacist-date">Date</Label>
                <Input
                  id="pharmacist-date"
                  type="date"
                  value={data.pharmacistDate}
                  onChange={(e) => setData((d) => ({ ...d, pharmacistDate: e.target.value }))}
                  disabled={readOnly}
                  className="mt-1"
                />
              </div>
            </div>
            <SignaturePad
              value={data.pharmacistSignature}
              onChange={(sig) => setData((d) => ({ ...d, pharmacistSignature: sig }))}
              disabled={readOnly}
            />
          </div>
        </CardContent>
      </Card>

      <ActiveShareLinks recordId={initial.recordId} refreshKey={shareRefreshKey} />

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

function DrugInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!value || value.length < 2) {
      setSuggestions([]);
      return;
    }
    let active = true;
    getDrugAutocompleteSuggestions(value).then((res) => {
      if (active) {
        setSuggestions(res);
      }
    });
    return () => {
      active = false;
    };
  }, [value]);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Amoxicillin"
        disabled={disabled}
        className="h-9"
      />
      {open && suggestions.length > 0 ? (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md text-popover-foreground">
          {suggestions.map((drug) => (
            <li
              key={drug}
              className="cursor-pointer px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(drug);
                setOpen(false);
              }}
            >
              {drug}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
