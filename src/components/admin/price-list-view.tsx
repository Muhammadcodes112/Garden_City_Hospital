"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, History, Loader2, Pencil, Tags } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getPriceHistory,
  moveService,
  setServiceActive,
  updateServicePrice,
  type PriceHistoryEntry,
  type PriceListCategory,
  type PriceListService,
} from "@/lib/actions/price-list";
import { formatKobo, koboToNairaInput } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { FOLDER_SWATCH } from "@/lib/folder-colours";


export function PriceListView({ categories }: { categories: PriceListCategory[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [historyFor, setHistoryFor] = useState<PriceListService | null>(null);
  const [history, setHistory] = useState<PriceHistoryEntry[] | null>(null);

  const needsPrice = categories.flatMap((c) =>
    c.services.filter((s) => s.priceKobo === 0).map((s) => ({ ...s, category: c.name })),
  );

  function run(action: () => Promise<{ success: true } | { success: false; error: string }>, onDone?: () => void) {
    startTransition(async () => {
      try {
        const res = await action();
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        onDone?.();
        router.refresh();
      } catch (err) {
        console.error("Price list action failed:", err);
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  function startEdit(s: PriceListService) {
    setEditingId(s.id);
    setPrice(s.priceKobo ? koboToNairaInput(s.priceKobo) : "");
    setReason("");
  }

  function saveEdit(serviceId: string) {
    run(
      () => updateServicePrice({ serviceId, price, reason }),
      () => {
        toast.success("Price updated");
        setEditingId(null);
      },
    );
  }

  async function openHistory(s: PriceListService) {
    setHistoryFor(s);
    setHistory(null);
    try {
      setHistory(await getPriceHistory(s.id));
    } catch (err) {
      console.error("Failed to load price history:", err);
      toast.error("Failed to load price history");
      setHistory([]);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="border-b border-border pb-4">
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Billing</span>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Tags className="h-6 w-6 text-brand-green" /> Price List
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Every price the cashier charges comes from this list. Each change needs a reason and is kept in the price history
          and activity log.
        </p>
      </div>

      {needsPrice.length > 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs">
          <p className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" /> {needsPrice.length} service{needsPrice.length === 1 ? "" : "s"} still need a price
          </p>
          <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 text-foreground">
            {needsPrice.map((s) => (
              <li key={s.id}>
                <span className="text-muted-foreground">{s.category}:</span> {s.name}
                {!s.active ? <span className="text-muted-foreground"> (inactive)</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {categories.map((cat) => (
        <Card key={cat.id}>
          <CardHeader className="py-4">
            <CardTitle className="text-sm sm:text-base">{cat.name}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-muted/50 border-b border-border font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-2 w-16">Order</th>
                    <th className="py-2.5 px-3">Service</th>
                    <th className="py-2.5 px-3 w-[260px]">Price</th>
                    <th className="py-2.5 px-3 w-16 text-center">Active</th>
                    <th className="py-2.5 px-3 w-32" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cat.services.map((s, i) => {
                    const editing = editingId === s.id;
                    return (
                      <tr key={s.id} className={s.active ? "" : "opacity-55"}>
                        <td className="py-2.5 px-2">
                          <div className="flex gap-0.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={pending || i === 0}
                              onClick={() => run(() => moveService(s.id, "up"))}
                              aria-label={`Move ${s.name} up`}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={pending || i === cat.services.length - 1}
                              onClick={() => run(() => moveService(s.id, "down"))}
                              aria-label={`Move ${s.name} down`}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            {s.folderColour ? (
                              <span
                                className={`h-4 w-4 shrink-0 rounded-sm border ${FOLDER_SWATCH[s.folderColour] ?? "bg-muted"}`}
                                title={`${s.folderColour} folder`}
                              />
                            ) : null}
                            <span className="font-semibold text-foreground">{s.name}</span>
                            {s.code ? <span className="font-mono text-[10px] text-muted-foreground">{s.code}</span> : null}
                          </div>
                          {s.allowCustomAmount ? (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">Cashier can type the amount at the point of sale.</p>
                          ) : null}
                          {s.notes ? <p className="mt-0.5 text-[11px] text-muted-foreground">{s.notes}</p> : null}
                        </td>
                        <td className="py-2.5 px-3">
                          {editing ? (
                            <div className="space-y-1.5">
                              <div className="relative">
                                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
                                <Input
                                  autoFocus
                                  inputMode="decimal"
                                  value={price}
                                  onChange={(e) => setPrice(e.target.value)}
                                  placeholder="12,000"
                                  className="h-8 pl-6 text-xs"
                                  aria-label={`New price for ${s.name}`}
                                />
                              </div>
                              <Input
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Reason (required), e.g. 2027 tariff review"
                                className="h-8 text-xs"
                                aria-label="Reason for price change"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit(s.id);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                              />
                              <div className="flex gap-1.5">
                                <Button type="button" size="sm" className="h-7 text-xs gap-1" disabled={pending} onClick={() => saveEdit(s.id)}>
                                  {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Save
                                </Button>
                                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-sm text-foreground">{formatKobo(s.priceKobo)}</span>
                              {s.priceKobo === 0 ? (
                                <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/40 text-[10px]">
                                  Needs price
                                </Badge>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Checkbox
                            checked={s.active}
                            disabled={pending}
                            onCheckedChange={(checked) => run(() => setServiceActive(s.id, checked === true))}
                            aria-label={`${s.name} active`}
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex justify-end gap-1">
                            {!editing ? (
                              <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" onClick={() => startEdit(s)}>
                                <Pencil className="h-3 w-3" /> Edit
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 px-2 text-[11px]"
                              onClick={() => openHistory(s)}
                              aria-label={`Price history for ${s.name}`}
                            >
                              <History className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={Boolean(historyFor)} onOpenChange={(open) => !open && setHistoryFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Price history
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              {historyFor?.name} · current price {historyFor ? formatKobo(historyFor.priceKobo) : ""}
            </DialogDescription>
          </DialogHeader>
          {history === null ? (
            <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No price changes yet. This is the seeded price.</p>
          ) : (
            <ul className="max-h-[60vh] space-y-2 overflow-y-auto text-xs">
              {history.map((h) => (
                <li key={h.id} className="rounded-lg border border-border p-2.5">
                  <p className="font-mono font-bold text-foreground">
                    {formatKobo(h.oldPriceKobo)} → {formatKobo(h.newPriceKobo)}
                  </p>
                  <p className="mt-0.5 text-foreground">{h.reason}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatDate(h.changedAt)} {new Date(h.changedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
                    {h.changedByName ?? "Unknown user"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
