"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  Upload,
  Image as ImageIcon,
  Trash2,
  ExternalLink,
  Eye,
  Loader2,
  CreditCard,
  Building,
  Banknote,
  ShieldAlert,
  FileCheck2,
  AlertCircle,
  X,
  Maximize2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import type { PatientRecord } from "./patient-case-file-modal";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientRecord;
  onUpdated?: (updatedPatient?: any) => void;
};

const PAYMENT_METHODS = [
  { id: "POS Terminal", label: "POS Terminal", icon: CreditCard },
  { id: "Bank Transfer", label: "Bank Transfer", icon: Building },
  { id: "Cash", label: "Cash", icon: Banknote },
  { id: "HMO / Corporate", label: "HMO / Insurance", icon: FileCheck2 },
  { id: "Other", label: "Other", icon: CreditCard },
];

export function CashierPaymentModal({ open, onOpenChange, patient, onUpdated }: Props) {
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isPaid, setIsPaid] = useState<boolean>(patient.paymentStatus === "paid");
  const [amount, setAmount] = useState<string>(patient.paymentAmount || "");
  const [method, setMethod] = useState<string>(patient.paymentMethod || "POS Terminal");
  const [reference, setReference] = useState<string>(patient.paymentReference || "");
  const [notes, setNotes] = useState<string>(patient.paymentNotes || "");

  // Evidence state
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string>(patient.paymentEvidenceUrl || "");
  const [evidenceName, setEvidenceName] = useState<string>(patient.paymentEvidenceName || "");
  const [removeEvidence, setRemoveEvidence] = useState(false);

  const [saving, setSaving] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  // Sync state when patient changes or modal opens
  useEffect(() => {
    if (open && patient) {
      setIsPaid(patient.paymentStatus === "paid");
      setAmount(patient.paymentAmount || "");
      setMethod(patient.paymentMethod || "POS Terminal");
      setReference(patient.paymentReference || "");
      setNotes(patient.paymentNotes || "");
      setEvidencePreview(patient.paymentEvidenceUrl || "");
      setEvidenceName(patient.paymentEvidenceName || "");
      setEvidenceFile(null);
      setRemoveEvidence(false);
    }
  }, [open, patient]);

  // Handle clipboard paste (Ctrl+V) for screenshot images
  useEffect(() => {
    if (!open) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            setEvidenceFile(file);
            setEvidenceName(file.name || `screenshot_${Date.now()}.png`);
            setRemoveEvidence(false);
            const objectUrl = URL.createObjectURL(file);
            setEvidencePreview(objectUrl);
            toast.success("Payment screenshot pasted from clipboard!");
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size cannot exceed 10MB");
        return;
      }
      setEvidenceFile(file);
      setEvidenceName(file.name);
      setRemoveEvidence(false);
      const objectUrl = URL.createObjectURL(file);
      setEvidencePreview(objectUrl);
      toast.info(`Selected: ${file.name}`);
    }
  };

  const handleRemoveEvidence = () => {
    setEvidenceFile(null);
    setEvidencePreview("");
    setEvidenceName("");
    setRemoveEvidence(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.info("Payment evidence removed");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const formData = new FormData();
      formData.set("status", isPaid ? "paid" : "pending");
      formData.set("isPaid", isPaid ? "true" : "false");
      formData.set("amount", amount.trim());
      formData.set("method", method.trim());
      formData.set("reference", reference.trim());
      formData.set("notes", notes.trim());
      if (removeEvidence) {
        formData.set("removeEvidence", "true");
      }
      if (evidenceFile) {
        formData.set("evidence", evidenceFile);
      }

      const res = await fetch(`/api/patients/${patient.id}/payment`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save payment status");
      }

      toast.success(
        isPaid
          ? `Payment verified & confirmed for ${patient.firstNames} ${patient.surname}`
          : `Payment status marked as pending for ${patient.firstNames} ${patient.surname}`,
      );

      if (onUpdated) {
        onUpdated(data.patient);
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error("Payment update failed:", err);
      toast.error(err.message || "Failed to update payment status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg w-full p-0 overflow-hidden rounded-2xl border-border bg-card shadow-2xl">
          {/* HEADER BANNER */}
          <div
            className={`p-5 border-b transition-colors ${
              isPaid
                ? "bg-gradient-to-r from-emerald-600/15 via-teal-600/10 to-transparent border-emerald-500/20"
                : "bg-gradient-to-r from-amber-600/15 via-orange-600/10 to-transparent border-amber-500/20"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={`font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 border ${
                      isPaid
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {isPaid ? "Payment Verified" : "Payment Pending"}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">{patient.hospitalNumber}</span>
                </div>
                <h2 className="text-lg font-bold text-foreground mt-1.5">
                  {patient.firstNames} {patient.surname}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Cashier & Billing Clearance Desk · Garden City Specialist Hospital
                </p>
              </div>

              {/* Ticker Indicator Icon */}
              <div
                className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  isPaid
                    ? "bg-emerald-600 text-white shadow-emerald-500/25 ring-4 ring-emerald-500/20"
                    : "bg-amber-500 text-white shadow-amber-500/25 ring-4 ring-amber-500/20"
                }`}
              >
                {isPaid ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
              </div>
            </div>
          </div>

          {/* FORM CONTENT */}
          <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* CASHIER TICKER TOGGLE CARD */}
            <div
              onClick={() => setIsPaid(!isPaid)}
              className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 select-none flex items-center justify-between gap-4 ${
                isPaid
                  ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-xs ring-1 ring-emerald-500/30"
                  : "border-border bg-muted/40 hover:bg-muted/70"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-6 w-6 rounded-md border flex items-center justify-center transition-colors ${
                    isPaid
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-muted-foreground/40 bg-background"
                  }`}
                >
                  {isPaid && <CheckCircle2 className="h-4 w-4 stroke-[3]" />}
                </div>
                <div>
                  <span className="font-bold text-sm text-foreground block">
                    {isPaid ? "Payment confirmed by cashier" : "Mark as paid (Confirm payment)"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isPaid
                      ? "Patient is cleared of hospital billing fees."
                      : "Tick after confirming patient has made payment via POS, transfer, or cash."}
                  </span>
                </div>
              </div>

              <Badge
                className={`font-mono text-xs font-bold px-2.5 py-1 ${
                  isPaid
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {isPaid ? "PAID ✓" : "UNPAID"}
              </Badge>
            </div>

            {/* PAYMENT DETAILS (Amount & Reference) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="payment-amount" className="text-xs font-semibold">
                  Amount Paid (₦)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-xs">
                    ₦
                  </span>
                  <Input
                    id="payment-amount"
                    type="text"
                    placeholder="e.g. 15,000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-7 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payment-reference" className="text-xs font-semibold">
                  Receipt / POS / Ref No
                </Label>
                <Input
                  id="payment-reference"
                  type="text"
                  placeholder="e.g. POS-98214 or Zen-3482"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            {/* PAYMENT METHOD PILLS */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold block">Payment Method</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = m.icon;
                  const isSelected = method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors text-left ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 font-bold shadow-xs"
                          : "border-border bg-background hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-emerald-600" : "text-muted-foreground"}`} />
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* EVIDENCE OF PAYMENT (Screenshot / Photo Upload) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Evidence of Payment (Screenshot / Receipt Photo)
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  Paste screenshot (Ctrl+V) or upload
                </span>
              </div>

              {evidencePreview ? (
                /* PREVIEW CARD */
                <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      onClick={() => setShowLightbox(true)}
                      className="h-14 w-14 rounded-lg border border-border bg-card overflow-hidden shrink-0 cursor-pointer hover:opacity-90 relative group shadow-xs"
                    >
                      {evidencePreview.endsWith(".pdf") ? (
                        <div className="h-full w-full flex items-center justify-center bg-rose-50 text-rose-700">
                          <FileCheck2 className="h-6 w-6" />
                        </div>
                      ) : (
                        <img
                          src={evidencePreview}
                          alt="Payment Evidence"
                          className="h-full w-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                        <Eye className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground truncate">
                        {evidenceName || "payment-proof.png"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                          Proof Attached
                        </Badge>
                        <button
                          type="button"
                          onClick={() => setShowLightbox(true)}
                          className="text-[11px] font-medium text-brand-green hover:underline flex items-center gap-1"
                        >
                          <Maximize2 className="h-3 w-3" /> View full photo
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-7 text-xs px-2"
                    >
                      Replace
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={handleRemoveEvidence}
                      className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                /* UPLOAD DROPZONE */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border-2 border-dashed border-border hover:border-emerald-500 bg-muted/20 hover:bg-emerald-50/20 p-5 text-center cursor-pointer transition-colors"
                >
                  <div className="mx-auto h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mb-2">
                    <Upload className="h-4 w-4" />
                  </div>
                  <p className="font-semibold text-xs text-foreground">
                    Click to browse or drop payment photo here
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Supports PNG, JPG, WEBP, or PDF. You can also paste directly with <kbd className="px-1 py-0.5 bg-muted rounded border text-[10px]">Ctrl+V</kbd>
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* CASHIER NOTES */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-notes" className="text-xs font-semibold">
                Cashier Memo / Notes (Optional)
              </Label>
              <Textarea
                id="payment-notes"
                placeholder="e.g. Paid in full via POS terminal #2, verified by alert."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            {/* AUDIT NOTE */}
            <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground flex items-center gap-2 border border-border">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>
                Staff confirmation recorded under:{" "}
                <strong className="text-foreground">
                  {session?.user?.name || session?.user?.email || "Current Cashier"}
                </strong>
              </span>
            </div>

            {/* FOOTER ACTIONS */}
            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className={`text-xs font-bold gap-1.5 text-white ${
                  isPaid ? "bg-emerald-600 hover:bg-emerald-700" : "bg-brand-green hover:bg-emerald-700"
                }`}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isPaid ? "Confirm Payment & Save" : "Save as Pending"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* LIGHTBOX MODAL FOR FULL EVIDENCE VIEW */}
      {showLightbox && evidencePreview && (
        <Dialog open={showLightbox} onOpenChange={setShowLightbox}>
          <DialogContent className="max-w-3xl w-full p-2 bg-black/95 text-white border-none rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold text-xs truncate max-w-sm">
                  {evidenceName || "Payment Evidence"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="ghost" className="h-7 text-xs text-white hover:bg-white/10">
                  <a href={evidencePreview} download={evidenceName || "payment-evidence"} target="_blank" rel="noreferrer">
                    <Download className="h-3.5 w-3.5 mr-1" /> Open / Download
                  </a>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowLightbox(false)}
                  className="h-7 w-7 text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-4 flex items-center justify-center max-h-[75vh] overflow-auto">
              {evidencePreview.endsWith(".pdf") ? (
                <iframe src={evidencePreview} className="w-full h-[65vh] rounded-lg" title="Payment PDF" />
              ) : (
                <img
                  src={evidencePreview}
                  alt="Full Payment Evidence"
                  className="max-h-[70vh] w-auto object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
