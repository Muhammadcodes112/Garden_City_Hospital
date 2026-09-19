"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Eye, Upload, Bold, Italic, List, Check, X } from "lucide-react";
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
import { MedicalReportLetterheadPreview } from "./medical-report-letterhead-preview";
import {
  completeMedicalReportForm,
  saveMedicalReportForm,
  type MedicalReportFormBundle,
} from "@/lib/actions/medical-report-form";
import { medicalReportPdfFilename } from "@/lib/pdf-templates/medical-report";
import {
  MEDICAL_REPORT_SECTIONS,
  type MedicalReportData,
  type SectionKey,
} from "@/lib/validators/medical-report";

type AutosavePayload = {
  patient: PatientFields;
  data: MedicalReportData;
};

type Props = {
  initial: MedicalReportFormBundle;
};

export function MedicalReportEditor({ initial }: Props) {
  const router = useRouter();
  const readOnly = initial.status === "completed";
  const [patient, setPatient] = useState<PatientFields>(initial.patient);
  const [data, setData] = useState<MedicalReportData>(initial.data);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [serverUpdatedAt, setServerUpdatedAt] = useState(initial.updatedAt);

  const getPayload = useCallback((): AutosavePayload => ({ patient, data }), [patient, data]);

  const onSave = useCallback(
    async (payload: AutosavePayload) => {
      const result = await saveMedicalReportForm({
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
    formType: "medical_report",
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

  function updateSection(key: SectionKey, field: "enabled" | "content", value: boolean | string) {
    setData((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [key]: {
          ...prev.sections[key],
          [field]: value,
        },
      },
    }));
  }

  function handleStampUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setData((d) => ({ ...d, hospitalStamp: base64 }));
      }
    };
    reader.readAsDataURL(file);
  }

  function insertFormatting(key: SectionKey, formatType: "bold" | "italic" | "list") {
    const sec = data.sections[key];
    const content = sec?.content || "";
    let added = "";
    if (formatType === "bold") added = " **Bold Text** ";
    else if (formatType === "italic") added = " *Italic Text* ";
    else if (formatType === "list") added = "\n- Bullet point 1\n- Bullet point 2\n";

    updateSection(key, "content", content + added);
  }

  async function handleComplete() {
    setCompleteError(null);
    await flushSave();
    try {
      await completeMedicalReportForm({
        recordId: initial.recordId,
        patient,
        data,
      });
      router.refresh();
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : "Could not complete report");
    }
  }

  const pdfFilename = medicalReportPdfFilename(patient, data.reportDate);

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* ACTION BAR */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SaveStatus status={status} />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="lg:hidden"
            onClick={() => setMobilePreviewOpen(!mobilePreviewOpen)}
          >
            <Eye className="mr-1.5 h-4 w-4" />
            {mobilePreviewOpen ? "Hide Live Preview" : "Live Preview"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
            Preview PDF
          </Button>
          {!readOnly ? (
            <Button type="button" onClick={handleComplete}>
              Mark as Completed
            </Button>
          ) : (
            <Badge variant="completed">Completed</Badge>
          )}
        </div>
      </div>

      {completeError ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {completeError}
        </p>
      ) : null}

      {/* TWO-PANE LAYOUT: EDITOR LEFT, LIVE PREVIEW RIGHT */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12 items-start">
        {/* LEFT PANE: EDITOR */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* REPORT METADATA */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-primary" /> Report Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ref-no">Ref No.</Label>
                  <Input
                    id="ref-no"
                    value={data.refNo}
                    onChange={(e) => setData((d) => ({ ...d, refNo: e.target.value }))}
                    disabled={readOnly}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="report-date">Report Date</Label>
                  <Input
                    id="report-date"
                    type="date"
                    value={data.reportDate}
                    onChange={(e) => setData((d) => ({ ...d, reportDate: e.target.value }))}
                    disabled={readOnly}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="addressee">Addressee</Label>
                  <Input
                    id="addressee"
                    value={data.addressee}
                    onChange={(e) => setData((d) => ({ ...d, addressee: e.target.value }))}
                    placeholder="To Whom It May Concern"
                    disabled={readOnly}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="report-title">Report Title</Label>
                  <Input
                    id="report-title"
                    value={data.reportTitle}
                    onChange={(e) => setData((d) => ({ ...d, reportTitle: e.target.value }))}
                    placeholder="MEDICAL REPORT"
                    disabled={readOnly}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PATIENT SELECTION */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Patient Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PatientPicker patient={patient} onPatientChange={setPatient} disabled={readOnly} />
              <div className="grid gap-4 sm:grid-cols-2 border-t border-border pt-3">
                <div>
                  <Label htmlFor="adm-date">First Visit / Admission Date</Label>
                  <Input
                    id="adm-date"
                    type="date"
                    value={data.admissionDate}
                    onChange={(e) => setData((d) => ({ ...d, admissionDate: e.target.value }))}
                    disabled={readOnly}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="dis-date">Discharge Date (Optional)</Label>
                  <Input
                    id="dis-date"
                    type="date"
                    value={data.dischargeDate}
                    onChange={(e) => setData((d) => ({ ...d, dischargeDate: e.target.value }))}
                    disabled={readOnly}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* REPORT SECTIONS */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Report Sections</CardTitle>
              <span className="text-xs text-muted-foreground">Toggle sections on/off as needed</span>
            </CardHeader>
            <CardContent className="space-y-6">
              {MEDICAL_REPORT_SECTIONS.map(({ key, label }) => {
                const sec = data.sections[key] || { enabled: true, content: "" };
                return (
                  <div key={key} className="rounded-lg border border-border p-4 space-y-2 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`sec-toggle-${key}`} className="font-semibold text-sm cursor-pointer">
                          {label}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={sec.enabled ? "default" : "outline"}
                          className="h-7 text-xs"
                          disabled={readOnly}
                          onClick={() => updateSection(key, "enabled", !sec.enabled)}
                        >
                          {sec.enabled ? (
                            <>
                              <Check className="mr-1 h-3 w-3" /> Included
                            </>
                          ) : (
                            <>
                              <X className="mr-1 h-3 w-3" /> Excluded
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {sec.enabled ? (
                      <div className="space-y-2 pt-1">
                        {!readOnly ? (
                          <div className="flex items-center gap-1 pb-1 border-b border-border">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Add bold formatting"
                              onClick={() => insertFormatting(key, "bold")}
                            >
                              <Bold className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Add italic formatting"
                              onClick={() => insertFormatting(key, "italic")}
                            >
                              <Italic className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Add bullet list"
                              onClick={() => insertFormatting(key, "list")}
                            >
                              <List className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : null}
                        <textarea
                          rows={4}
                          value={sec.content}
                          onChange={(e) => updateSection(key, "content", e.target.value)}
                          placeholder={`Enter ${label.toLowerCase()} details...`}
                          disabled={readOnly}
                          className="w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Section excluded from report and PDF output.
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* DOCTOR SIGN-OFF & STAMP */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Doctor Sign-off & Stamp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="doctor-name">Doctor's Name</Label>
                  <Input
                    id="doctor-name"
                    value={data.doctorName}
                    onChange={(e) => setData((d) => ({ ...d, doctorName: e.target.value }))}
                    placeholder="Dr. John Doe"
                    disabled={readOnly}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="doctor-desig">Designation</Label>
                  <Input
                    id="doctor-desig"
                    value={data.doctorDesignation}
                    onChange={(e) => setData((d) => ({ ...d, doctorDesignation: e.target.value }))}
                    placeholder="Medical Officer / Consultant"
                    disabled={readOnly}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <Label>Doctor's Signature</Label>
                <SignaturePad
                  value={data.doctorSignature}
                  onChange={(sig) =>
                    setData((d) => ({
                      ...d,
                      doctorSignature: sig ?? { mode: "draw", data: "" },
                    }))
                  }
                  disabled={readOnly}
                />
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <Label htmlFor="stamp-upload">Hospital Stamp (Optional)</Label>
                <div className="flex items-center gap-3">
                  {!readOnly ? (
                    <div className="relative">
                      <Button type="button" variant="outline" className="h-9 gap-1.5 text-xs">
                        <Upload className="h-3.5 w-3.5" /> Upload Stamp Image
                      </Button>
                      <input
                        id="stamp-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleStampUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  ) : null}
                  {data.hospitalStamp ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={data.hospitalStamp}
                        alt="Stamp Preview"
                        className="h-10 w-16 object-contain rounded border border-border bg-white"
                      />
                      {!readOnly ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-destructive"
                          onClick={() => setData((d) => ({ ...d, hospitalStamp: "" }))}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No stamp uploaded</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PANE: LIVE LETTERHEAD PREVIEW (DESKTOP STICKY) */}
        <div className="hidden lg:block lg:col-span-5 sticky top-6">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Live Letterhead Preview</span>
                <Badge variant="default" className="text-[10px] font-normal">
                  A4 Realtime
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 bg-muted/20">
              <MedicalReportLetterheadPreview
                patient={patient}
                data={data}
                isDraft={initial.status === "draft"}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MOBILE LIVE PREVIEW */}
      {mobilePreviewOpen ? (
        <div className="lg:hidden mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Live Letterhead Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-3 bg-muted/20">
              <MedicalReportLetterheadPreview
                patient={patient}
                data={data}
                isDraft={initial.status === "draft"}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      <PdfPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        recordId={initial.recordId}
        filename={pdfFilename}
      />
    </div>
  );
}
