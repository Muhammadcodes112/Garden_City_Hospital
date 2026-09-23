"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DocumentViewer } from "@/components/forms/document-viewer";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
  filename: string;
};

export function PdfPreviewDialog({ open, onOpenChange, recordId, filename }: Props) {
  const formType = filename.includes("LabRequest")
    ? "lab"
    : filename.includes("Prescription")
      ? "prescription"
      : "medical_report";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex h-[92vh] w-[min(1000px,96vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-slate-800 bg-slate-950 shadow-2xl outline-none overflow-hidden",
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5">
            <DialogPrimitive.Title className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Document Preview
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="relative flex-1 overflow-hidden">
            <DocumentViewer
              recordId={recordId}
              formType={formType}
              filename={filename}
              isPublic={false}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
