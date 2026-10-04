"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { X, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-slate-700/80 bg-slate-900/90 p-1 text-white shadow-xl backdrop-blur">
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => zoomOut()}>
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => zoomIn()}>
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => resetTransform()}>
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ImageLightbox({
  open,
  onOpenChange,
  src,
  alt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex h-[92vh] w-[min(1000px,96vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-slate-800 bg-slate-950 shadow-2xl outline-none overflow-hidden">
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <Button size="icon" variant="ghost" className="absolute right-3 top-3 z-10 h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </DialogPrimitive.Close>
          <div className="relative flex-1 overflow-hidden">
            <TransformWrapper initialScale={1} minScale={0.5} maxScale={6} centerOnInit>
              <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
              </TransformComponent>
              <ZoomControls />
            </TransformWrapper>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
