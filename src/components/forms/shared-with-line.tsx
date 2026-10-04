"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { getSharedWith } from "@/lib/actions/messages";
import type { SharedWithEntry } from "@/lib/message-attachments";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function SharedWithLine({ recordId, refreshKey }: { recordId: string; refreshKey?: number }) {
  const [entries, setEntries] = useState<SharedWithEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSharedWith(recordId)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoaded(true));
  }, [recordId, refreshKey]);

  if (!loaded || entries.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <Users className="h-3.5 w-3.5 shrink-0 text-brand-green" />
      <span className="font-medium text-foreground">Shared with:</span>
      {entries.map((e, i) => (
        <span key={`${e.recipientId}-${e.sentAt}`}>
          {e.recipientName} ({relativeTime(e.sentAt)}){i < entries.length - 1 ? "," : ""}
        </span>
      ))}
    </div>
  );
}
