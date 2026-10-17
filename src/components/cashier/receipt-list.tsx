"use client";

import { useState } from "react";
import { Ban, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { recordReceiptPrint, type ReceiptSummary } from "@/lib/actions/cashier";
import { CASHIER_VOID_WINDOW_HOURS } from "@/lib/cashier-policy";
import { formatKobo } from "@/lib/money";
import { PAYMENT_MODE_LABELS } from "@/lib/validators/cashier";

/**
 * Records the print, then shows the PDF. The window is opened synchronously in
 * the click handler (before any await) so popup blockers allow it.
 */
export async function printReceipt(receiptId: string): Promise<void> {
  const win = window.open("", "_blank");
  try {
    const res = await recordReceiptPrint(receiptId);
    if (!res.success) {
      win?.close();
      toast.error(res.error);
      return;
    }
    const url = `/api/cashier/receipts/${receiptId}/pdf?print=${res.printId}`;
    if (win) win.location.href = url;
    else window.open(url, "_blank");
    if (res.copy > 1) toast.info(`Printing duplicate (copy ${res.copy})`);
  } catch (err) {
    win?.close();
    console.error("Print failed:", err);
    toast.error("Could not print the receipt");
  }
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ReceiptList({
  receipts,
  onChanged,
  emptyText = "No receipts yet in this shift.",
}: {
  /** Each receipt's canVoid says whether this viewer may void it; the API re-checks. */
  receipts: ReceiptSummary[];
  onChanged: () => void;
  emptyText?: string;
}) {
  const [voiding, setVoiding] = useState<ReceiptSummary | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirmVoid() {
    if (!voiding) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cashier/receipts/${voiding.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "Could not void the receipt");
        if (res.status === 403) onChanged();
        return;
      }
      toast.success(`Receipt ${voiding.receiptNo} voided`);
      setVoiding(null);
      setReason("");
      onChanged();
    } catch (err) {
      console.error("Void failed:", err);
      toast.error("Could not void the receipt");
    } finally {
      setBusy(false);
    }
  }

  if (receipts.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <>
      <ul className="space-y-2">
        {receipts.map((r) => {
          const voided = r.status === "voided";
          return (
            <li key={r.id} className={`rounded-xl border p-3 ${voided ? "border-rose-300 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20" : "border-border bg-card"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold text-muted-foreground">Nº {r.receiptNo}</p>
                  <p className="truncate text-sm font-semibold text-foreground">{r.payerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {PAYMENT_MODE_LABELS[r.paymentMode]} · {time(r.issuedAt)}
                    {r.printCount > 1 ? ` · ${r.printCount} prints` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-mono text-base font-black ${voided ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {formatKobo(r.totalKobo)}
                  </p>
                  {voided ? <Badge className="bg-rose-600 text-white text-[10px]">VOIDED</Badge> : null}
                </div>
              </div>
              {voided && r.voidReason ? <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">Reason: {r.voidReason}</p> : null}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="h-11 gap-1.5" onClick={() => printReceipt(r.id).then(onChanged)}>
                  <Printer className="h-4 w-4" /> {r.printCount > 0 ? "Re-print" : "Print"}
                </Button>
                {!voided && r.canVoid ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950"
                    onClick={() => {
                      setVoiding(r);
                      setReason("");
                    }}
                  >
                    <Ban className="h-4 w-4" /> Void
                  </Button>
                ) : !voided ? (
                  <span
                    className="flex h-11 items-center justify-center rounded-md border border-dashed border-border px-2 text-center text-xs font-semibold text-muted-foreground"
                    title={`Cashiers can void only their own receipts, in their open shift, within ${CASHIER_VOID_WINDOW_HOURS} hours`}
                  >
                    Ask a super admin
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={Boolean(voiding)} onOpenChange={(open) => !open && setVoiding(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-700 dark:text-rose-400">Void receipt Nº {voiding?.receiptNo}?</DialogTitle>
            <DialogDescription className="text-xs pt-1">
              {voiding ? `${voiding.payerName} · ${formatKobo(voiding.totalKobo)}. ` : ""}
              The receipt keeps its number and prints as VOIDED. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="void-reason">Reason (required)</Label>
            <Textarea
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Wrong service selected; patient changed payment mode"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setVoiding(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" className="h-11 gap-1.5" disabled={busy || reason.trim().length < 3} onClick={confirmVoid}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Void receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
