"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MessageAvatar } from "./avatar";
import { useMessagesPoll } from "@/hooks/use-messages-poll";
import type { PersonSummary } from "@/lib/messages";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function PeopleList({
  initialPeople,
  activeUserId,
}: {
  initialPeople: PersonSummary[];
  activeUserId?: string;
}) {
  const { people, ready } = useMessagesPoll();
  const [search, setSearch] = useState("");
  const list = ready ? people : initialPeople;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
  }, [list, search]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search admins..."
            className="pl-9 text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No admins found.</p>}
        {filtered.map((p) => (
          <Link
            key={p.id}
            href={`/messages/${p.id}`}
            className={cn(
              "flex items-center gap-3 border-b border-border/60 px-4 py-3 transition-colors hover:bg-muted/50",
              activeUserId === p.id && "bg-muted",
            )}
          >
            <MessageAvatar name={p.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-foreground">{p.name}</span>
                {p.isSuperAdmin && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {p.lastMessage ? `${p.lastMessage.fromMe ? "You: " : ""}${p.lastMessage.preview}` : "No messages yet"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {p.lastMessage && <span className="text-[11px] text-muted-foreground">{relativeTime(p.lastMessage.at)}</span>}
              {p.unreadCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1.5 text-[10px] font-bold text-white">
                  {p.unreadCount > 99 ? "99+" : p.unreadCount}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
