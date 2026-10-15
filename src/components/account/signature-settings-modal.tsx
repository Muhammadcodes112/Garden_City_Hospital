"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signatureUrl: string | null;
  onUpdated: (signatureUrl: string | null) => void;
};

export function SignatureSettingsModal({ open, onOpenChange, signatureUrl, onUpdated }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/account/signature", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save signature");
        return;
      }
      toast.success("Signature saved. It will appear on forms you create from now on.");
      onUpdated(data.signatureUrl);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      toast.error("Failed to save signature");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch("/api/account/signature", { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to remove signature");
        return;
      }
      toast.success("Signature removed");
      onUpdated(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove signature");
    } finally {
      setRemoving(false);
    }
  }

  const displayUrl = preview || signatureUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>My signature</DialogTitle>
          <DialogDescription>
            Upload your signature once. It will be used automatically on every lab request,
            prescription, and medical report you create — no more drawing it each time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-4">
            {displayUrl ? (
              <img src={displayUrl} alt="Signature preview" className="h-24 max-w-full object-contain" />
            ) : (
              <p className="text-sm text-muted-foreground">No signature saved yet</p>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="text-sm"
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {signatureUrl ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleRemove}
              disabled={removing || saving}
              className="text-destructive gap-1.5"
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" onClick={handleSave} disabled={!preview || saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {saving ? "Saving..." : "Save signature"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
