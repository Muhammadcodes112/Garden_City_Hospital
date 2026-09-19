"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
  filename: string;
};

export function PdfPreviewDialog({ open, onOpenChange, recordId, filename }: Props) {
  const [loading, setLoading] = useState(true);
  const src = `/api/forms/${recordId}/pdf`;

  useEffect(() => {
    if (open) setLoading(true);
  }, [open, recordId]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex h-[90vh] w-[min(960px,95vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-card shadow-xl outline-none",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <DialogPrimitive.Title className="text-sm font-semibold">
              PDF preview
            </DialogPrimitive.Title>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={`${src}?download=1`} download={filename}>
                  Download
                </a>
              </Button>
              <DialogPrimitive.Close asChild>
                <Button size="icon" variant="ghost" aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>
          <div className="relative flex-1 bg-muted/30">
            {loading ? (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Generating PDF…
              </p>
            ) : null}
            <iframe
              title="PDF preview"
              src={src}
              className="h-full w-full border-0"
              onLoad={() => setLoading(false)}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
