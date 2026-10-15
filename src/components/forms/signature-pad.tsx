"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LabRequestData } from "@/lib/validators/lab-request";

type Props = {
  value: LabRequestData["doctorSignature"];
  onChange: (value: LabRequestData["doctorSignature"]) => void;
  disabled?: boolean;
  /** The signature image saved on the current user's account, if any (see "My signature" in the account menu). */
  savedSignatureUrl?: string | null;
};

export function SignaturePad({ value, onChange, disabled, savedSignatureUrl }: Props) {
  const [mode, setMode] = useState<"draw" | "type" | "image">(value?.mode ?? "type");

  function useSavedSignature() {
    if (!savedSignatureUrl) return;
    setMode("image");
    onChange({ mode: "image", data: savedSignatureUrl });
  }
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const startDraw = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled || mode !== "draw") return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      drawing.current = true;
      canvas.setPointerCapture(e.pointerId);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.strokeStyle = "#1e3a8a";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    },
    [disabled, mode],
  );

  const moveDraw = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || mode !== "draw") return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    },
    [mode],
  );

  const endDraw = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      onChange({ mode: "draw", data: canvas.toDataURL("image/png") });
    }
  }, [onChange]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange({ mode: "draw", data: "" });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {savedSignatureUrl ? (
          <Button
            type="button"
            size="sm"
            variant={mode === "image" ? "default" : "outline"}
            onClick={useSavedSignature}
            disabled={disabled}
          >
            Use my signature
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant={mode === "type" ? "default" : "outline"}
          onClick={() => setMode("type")}
          disabled={disabled}
        >
          Type name
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "draw" ? "default" : "outline"}
          onClick={() => setMode("draw")}
          disabled={disabled}
        >
          Draw signature
        </Button>
      </div>
      {mode === "image" ? (
        <div>
          <Label>Saved signature</Label>
          {value?.data ? (
            <img
              src={value.data}
              alt="Saved signature"
              className="mt-1 h-20 max-w-xs rounded-md border border-border bg-white object-contain p-2"
            />
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No saved signature selected.</p>
          )}
        </div>
      ) : mode === "type" ? (
        <div>
          <Label htmlFor="sig-type">Doctor&apos;s signature (typed)</Label>
          <Input
            id="sig-type"
            value={value?.mode === "type" ? value.data : ""}
            onChange={(e) => onChange({ mode: "type", data: e.target.value })}
            disabled={disabled}
            placeholder="Type doctor name as signature"
          />
        </div>
      ) : (
        <div>
          <Label>Draw signature</Label>
          <canvas
            ref={canvasRef}
            width={400}
            height={120}
            className="mt-1 w-full max-w-md touch-none rounded-md border border-border bg-white"
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
          />
          <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={clearCanvas}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
