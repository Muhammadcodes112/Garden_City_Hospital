"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Copy, Share2, MessageCircle, Mail, X, Check, Clock, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createShareLink } from "@/lib/actions/share";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
  filename: string;
  onLinkCreated?: () => void;
};

export function ShareDialog({
  open,
  onOpenChange,
  recordId,
  filename,
  onLinkCreated,
}: Props) {
  const [expiryDays, setExpiryDays] = useState<1 | 7 | 30>(7);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [webShareSupported, setWebShareSupported] = useState(false);
  const [nativeSharing, setNativeSharing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof navigator.share === "function") {
      setWebShareSupported(true);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setShareUrl(null);
      setCopied(false);
    }
  }, [open]);

  async function handleGenerateLink() {
    setLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const res = await createShareLink({
        formRecordId: recordId,
        expiryDays,
        origin,
      });
      setShareUrl(res.url);
      toast.success(`Share link generated (expires in ${expiryDays} day${expiryDays > 1 ? "s" : ""})`);
      if (onLinkCreated) onLinkCreated();
    } catch (err) {
      console.error("Failed to generate share link:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate share link");
    } finally {
      setLoading(false);
    }
  }

  async function handleNativeShare() {
    if (!navigator.share) return;
    setNativeSharing(true);
    try {
      const pdfRes = await fetch(`/api/forms/${recordId}/pdf`);
      const blob = await pdfRes.blob();
      const file = new File([blob], filename, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: filename,
          text: "Garden City Specialist Hospital Document",
          files: [file],
        });
      } else {
        await navigator.share({
          title: filename,
          text: `Garden City Specialist Hospital Document: ${shareUrl || window.location.href}`,
        });
      }
      toast.success("Shared successfully");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Native share failed:", err);
        toast.error("Share failed");
      }
    } finally {
      setNativeSharing(false);
    }
  }

  function handleCopy() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2500);
  }

  const waText = encodeURIComponent(
    `Garden City Specialist Hospital Document:\n${shareUrl || ""}`,
  );
  const waUrl = `https://wa.me/?text=${waText}`;

  const mailSubject = encodeURIComponent("Garden City Specialist Hospital Document");
  const mailBody = encodeURIComponent(
    `Please click the secure link below to view your hospital document:\n\n${shareUrl || ""}\n\nNote: This link will expire automatically.`,
  );
  const mailUrl = `mailto:?subject=${mailSubject}&body=${mailBody}`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex w-[min(520px,95vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-card p-6 shadow-xl outline-none text-foreground",
          )}
        >
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <DialogPrimitive.Title className="text-base font-bold flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" /> Share Document
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="space-y-5 pt-4">
            {/* Native Mobile Share if supported */}
            {webShareSupported ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">Direct Mobile Share</span>
                  <span className="text-xs text-muted-foreground">Attach PDF file</span>
                </div>
                <Button
                  type="button"
                  className="w-full gap-2"
                  disabled={nativeSharing}
                  onClick={handleNativeShare}
                >
                  <Share2 className="h-4 w-4" />
                  {nativeSharing ? "Preparing PDF..." : "Share PDF to App (WhatsApp, Email...)"}
                </Button>
              </div>
            ) : null}

            {/* Expiry Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Link Expiry Duration
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={expiryDays === 1 ? "default" : "outline"}
                  className="text-xs"
                  onClick={() => setExpiryDays(1)}
                >
                  24 Hours
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={expiryDays === 7 ? "default" : "outline"}
                  className="text-xs"
                  onClick={() => setExpiryDays(7)}
                >
                  7 Days
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={expiryDays === 30 ? "default" : "outline"}
                  className="text-xs"
                  onClick={() => setExpiryDays(30)}
                >
                  30 Days
                </Button>
              </div>
            </div>

            {/* Generate Button or Result */}
            {!shareUrl ? (
              <Button
                type="button"
                className="w-full gap-2 mt-2"
                disabled={loading}
                onClick={handleGenerateLink}
              >
                <Link2 className="h-4 w-4" />
                {loading ? "Generating Secure Link..." : "Generate Secure Public Link"}
              </Button>
            ) : (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <Label className="text-xs font-semibold text-foreground">
                  Secure Public Link (No Login Required)
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none"
                  />
                  <Button type="button" size="sm" variant="default" onClick={handleCopy} className="gap-1 text-xs shrink-0">
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  >
                    <a href={waUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  >
                    <a href={mailUrl}>
                      <Mail className="h-4 w-4" /> Email
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
