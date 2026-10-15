"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Send, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  listActiveAdmins,
  sendPatientFilesToColleagues,
  type ActiveAdmin,
} from "@/lib/actions/send-to-colleague";

export function BulkSendPatientFilesPanel({
  patientIds,
  onSent,
}: {
  patientIds: string[];
  onSent: () => void;
}) {
  const [admins, setAdmins] = useState<ActiveAdmin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    listActiveAdmins()
      .then(setAdmins)
      .catch(() => toast.error("Failed to load colleagues"))
      .finally(() => setLoadingAdmins(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter((a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  }, [admins, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    if (selected.size === 0 || patientIds.length === 0) return;
    setSending(true);
    try {
      const result = await sendPatientFilesToColleagues({
        patientIds,
        recipientUserIds: Array.from(selected),
        note: note.trim() || undefined,
      });
      const colleagueCount = result.count / patientIds.length;
      toast.success(
        `Sent ${patientIds.length} patient file${patientIds.length === 1 ? "" : "s"} to ${colleagueCount} colleague${colleagueCount === 1 ? "" : "s"}`,
      );
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground">
        {patientIds.length} patient file{patientIds.length === 1 ? "" : "s"} selected
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Send to</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search admins..." className="pl-9 text-sm" />
        </div>
        <div className="max-h-48 overflow-y-auto rounded-md border border-border">
          {loadingAdmins ? (
            <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading colleagues...
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">No admins found.</p>
          ) : (
            filtered.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-2.5 border-b border-border/60 px-3 py-2 text-sm last:border-0 hover:bg-muted/40"
              >
                <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} />
                <span className="flex-1 truncate">{a.name}</span>
                {a.isSuperAdmin && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
              </label>
            ))
          )}
        </div>
        {selected.size > 0 && (
          <p className="text-xs text-muted-foreground">
            {selected.size} colleague{selected.size === 1 ? "" : "s"} selected
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bulk-send-patient-note" className="text-xs font-semibold">
          Note (optional)
        </Label>
        <Textarea
          id="bulk-send-patient-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a message…"
          className="min-h-16 text-sm"
        />
      </div>

      <Button type="button" className="w-full gap-2" disabled={selected.size === 0 || sending} onClick={handleSend}>
        <Send className="h-4 w-4" />
        {sending ? "Sending..." : `Send${selected.size > 0 ? ` to ${selected.size}` : ""}`}
      </Button>
    </div>
  );
}
