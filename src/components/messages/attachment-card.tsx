"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FlaskConical,
  Pill,
  FileText,
  ExternalLink,
  Eye,
  Download,
  Link2,
  Copy,
  Check,
  AlertTriangle,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PdfPreviewDialog } from "@/components/forms/pdf-preview-dialog";
import { ImageLightbox } from "./image-lightbox";
import { checkFormRecordAvailability, checkShareLinkAvailability } from "@/lib/actions/messages";
import { FORM_TYPE_LABELS } from "@/lib/routes";
import { formatDate } from "@/lib/date";
import type { SerializedAttachment } from "@/lib/message-attachments";

const FORM_ICONS = { lab: FlaskConical, prescription: Pill, medical_report: FileText } as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UnavailableCard({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
      {label}
    </div>
  );
}

export function AttachmentCard({ attachment }: { attachment: SerializedAttachment }) {
  if (attachment.kind === "form_record") return <FormRecordAttachment attachment={attachment} />;
  if (attachment.kind === "share_link") return <ShareLinkAttachment attachment={attachment} />;
  return <FileAttachment attachment={attachment} />;
}

function FormRecordAttachment({ attachment }: { attachment: Extract<SerializedAttachment, { kind: "form_record" }> }) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [stillAvailable, setStillAvailable] = useState(true);
  const [busy, setBusy] = useState<"open" | "preview" | "download" | null>(null);

  if (!attachment.available || !stillAvailable) {
    return <UnavailableCard label="This record is no longer available." />;
  }

  // Destructured so the already-narrowed literal types survive into the
  // nested closures below — TS drops discriminated-union narrowing across
  // closure boundaries, but a captured local const keeps its concrete type.
  const { formRecordId, formType, status, patientName, hospitalNumber, updatedAt } = attachment;

  async function recheck(): Promise<boolean> {
    const result = await checkFormRecordAvailability(formRecordId);
    if (!result.available) {
      setStillAvailable(false);
      return false;
    }
    return true;
  }

  async function handleOpen() {
    setBusy("open");
    try {
      // Opens the full-screen, read-only document viewer — not the editable
      // form page. Editing from here is reserved for super admins (via a
      // button inside that viewer), since the receiver didn't create this record.
      if (await recheck()) router.push(`/documents/${formRecordId}`);
    } finally {
      setBusy(null);
    }
  }

  async function handlePreview() {
    setBusy("preview");
    try {
      if (await recheck()) setPreviewOpen(true);
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    setBusy("download");
    try {
      if (await recheck()) {
        window.open(`/api/forms/${formRecordId}/pdf?download=1`, "_blank");
      }
    } finally {
      setBusy(null);
    }
  }

  const Icon = FORM_ICONS[formType];
  const filename = `${FORM_TYPE_LABELS[formType].replace(/\s+/g, "")}_${hospitalNumber}.pdf`;

  return (
    <div className="w-64 overflow-hidden rounded-lg border border-border bg-background/60">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon className="h-4 w-4 shrink-0 text-brand-green" />
        <span className="truncate text-xs font-semibold text-foreground">{FORM_TYPE_LABELS[formType]}</span>
      </div>
      <div className="px-3 py-2 space-y-1">
        <p className="truncate text-sm font-medium text-foreground">{patientName}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-mono text-muted-foreground">{hospitalNumber}</span>
          <Badge variant={status} className="shrink-0 text-[10px]">
            {status === "draft" ? "Draft" : "Completed"}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">{formatDate(updatedAt)}</p>
      </div>
      <div className="flex items-center gap-1 border-t border-border p-1.5">
        <Button type="button" size="sm" variant="ghost" className="h-7 flex-1 gap-1 text-[11px]" disabled={busy !== null} onClick={handleOpen}>
          <ExternalLink className="h-3 w-3" /> Open
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 flex-1 gap-1 text-[11px]" disabled={busy !== null} onClick={handlePreview}>
          <Eye className="h-3 w-3" /> Preview
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 flex-1 gap-1 text-[11px]" disabled={busy !== null} onClick={handleDownload}>
          <Download className="h-3 w-3" /> PDF
        </Button>
      </div>
      <PdfPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} recordId={formRecordId} filename={filename} formType={formType} />
    </div>
  );
}

function ShareLinkAttachment({ attachment }: { attachment: Extract<SerializedAttachment, { kind: "share_link" }> }) {
  const [revoked, setRevoked] = useState(attachment.revoked);
  const [copied, setCopied] = useState(false);
  const expired = attachment.expired;

  async function handleOpen() {
    const result = await checkShareLinkAvailability(attachment.shareLinkId);
    if (!result.available) {
      setRevoked(true);
      return;
    }
    window.open(attachment.url, "_blank");
  }

  function handleCopy() {
    navigator.clipboard.writeText(attachment.url);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  if (revoked || expired) return <UnavailableCard label={revoked ? "This link has been revoked." : "This link has expired."} />;

  return (
    <div className="w-64 overflow-hidden rounded-lg border border-border bg-background/60">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Link2 className="h-4 w-4 shrink-0 text-brand-green" />
        <span className="truncate text-xs font-semibold text-foreground">Secure Public Link</span>
      </div>
      <div className="px-3 py-2">
        <p className="truncate text-xs font-mono text-muted-foreground">{attachment.url}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Expires {formatDate(attachment.expiresAt)}</p>
      </div>
      <div className="flex items-center gap-1 border-t border-border p-1.5">
        <Button type="button" size="sm" variant="ghost" className="h-7 flex-1 gap-1 text-[11px]" onClick={handleOpen}>
          <ExternalLink className="h-3 w-3" /> Open
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 flex-1 gap-1 text-[11px]" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function FileAttachment({ attachment }: { attachment: Extract<SerializedAttachment, { kind: "file" }> }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isImage = attachment.mimeType.startsWith("image/");
  const viewUrl = `/api/messages/attachments/${attachment.id}/file`;
  const downloadUrl = `${viewUrl}?download=1`;

  if (isImage) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="block w-48 overflow-hidden rounded-lg border border-border"
          aria-label={`Open image ${attachment.fileName}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewUrl} alt={attachment.fileName} className="h-32 w-full object-cover" />
        </button>
        <ImageLightbox open={lightboxOpen} onOpenChange={setLightboxOpen} src={viewUrl} alt={attachment.fileName} />
      </>
    );
  }

  return (
    <div className="flex w-64 items-center gap-2.5 rounded-lg border border-border bg-background/60 px-3 py-2.5">
      <Paperclip className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{attachment.fileName}</p>
        <p className="text-[11px] text-muted-foreground">{formatBytes(attachment.fileSize)}</p>
      </div>
      <Button asChild type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0">
        <a href={downloadUrl} download={attachment.fileName} aria-label="Download file">
          <Download className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  );
}
