"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MessageAvatar } from "./avatar";
import { MessageBubble } from "./message-bubble";
import { Composer } from "./composer";
import { PrivacyNote } from "./privacy-note";
import { useMessagesPoll } from "@/hooks/use-messages-poll";
import { deleteMessage, loadOlderMessages, markConversationRead, sendMessage } from "@/lib/actions/messages";
import type { SerializedMessage } from "@/lib/messages";

export type ClientMessage = SerializedMessage & {
  status?: "pending" | "sent" | "failed";
};

type TargetUser = { id: string; name: string; email: string; isSuperAdmin: boolean };

const NEAR_BOTTOM_PX = 150;
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function dayLabel(d: Date): string {
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function ConversationView({
  meId,
  targetUser,
  initialConversationId,
  initialMessages,
  initialHasMore,
  initialOtherLastReadAt,
  readOnly,
}: {
  meId: string;
  targetUser: TargetUser;
  initialConversationId: string | null;
  initialMessages: SerializedMessage[];
  initialHasMore: boolean;
  initialOtherLastReadAt: string | null;
  readOnly: boolean;
}) {
  const { people, lastUpdates, updateTick } = useMessagesPoll();
  const [mounted, setMounted] = useState(false);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<ClientMessage[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number | null>(null);
  const readMarkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset local state when navigating between conversations (same component, new props).
  useEffect(() => {
    setConversationId(initialConversationId);
    setMessages(initialMessages);
    setHasMore(initialHasMore);
  }, [targetUser.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const container = containerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [mounted]);

  // Merge live updates from the shared poll into this thread.
  useEffect(() => {
    const relevant = lastUpdates.filter((m) =>
      conversationId ? m.conversationId === conversationId : m.senderId === targetUser.id,
    );
    if (relevant.length === 0) return;

    if (!conversationId && relevant[0]) setConversationId(relevant[0].conversationId);

    const container = containerRef.current;
    const wasNearBottom = container
      ? container.scrollHeight - container.scrollTop - container.clientHeight < NEAR_BOTTOM_PX
      : true;

    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of relevant) {
        if (m.senderId === meId) continue; // my own sends are reflected optimistically already
        byId.set(m.id, { ...byId.get(m.id), ...m });
      }
      return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });

    if (wasNearBottom) {
      requestAnimationFrame(() => {
        if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateTick]);

  const livePerson = people.find((p) => p.id === targetUser.id);
  const otherLastReadAt = livePerson?.otherLastReadAt ?? initialOtherLastReadAt;

  // Mark read when focused and there's something to read.
  useEffect(() => {
    if (!conversationId) return;
    function scheduleMarkRead() {
      if (!document.hasFocus()) return;
      if (readMarkTimerRef.current) clearTimeout(readMarkTimerRef.current);
      readMarkTimerRef.current = setTimeout(() => {
        void markConversationRead(conversationId!);
      }, 800);
    }
    scheduleMarkRead();
    window.addEventListener("focus", scheduleMarkRead);
    return () => {
      window.removeEventListener("focus", scheduleMarkRead);
      if (readMarkTimerRef.current) clearTimeout(readMarkTimerRef.current);
    };
  }, [conversationId, updateTick]);

  useLayoutEffect(() => {
    if (prevScrollHeightRef.current != null && containerRef.current) {
      const newHeight = containerRef.current.scrollHeight;
      containerRef.current.scrollTop += newHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = null;
    }
  }, [messages]);

  async function loadMore() {
    if (!conversationId || !hasMore || loadingMore) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingMore(true);
    prevScrollHeightRef.current = containerRef.current?.scrollHeight ?? null;
    try {
      const page = await loadOlderMessages(conversationId, oldest.createdAt);
      setMessages((prev) => [...page.messages, ...prev]);
      setHasMore(page.hasMore);
    } catch {
      prevScrollHeightRef.current = null;
    } finally {
      setLoadingMore(false);
    }
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (e.currentTarget.scrollTop < 60) void loadMore();
  }

  async function handleSend(body: string) {
    const clientId = `pending-${crypto.randomUUID()}`;
    const optimistic: ClientMessage = {
      id: clientId,
      conversationId: conversationId ?? "",
      senderId: meId,
      body,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      status: "pending",
    };
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() => {
      if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
    });

    try {
      const sent = await sendMessage({ targetUserId: targetUser.id, body });
      setConversationId(sent.conversationId);
      setMessages((prev) => prev.map((m) => (m.id === clientId ? { ...sent, status: "sent" } : m)));
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.id === clientId ? { ...m, status: "failed" } : m)));
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    }
  }

  function handleRetry(message: ClientMessage) {
    if (!message.body) return;
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    void handleSend(message.body);
  }

  async function handleDelete(id: string) {
    const previous = messages;
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deletedAt: new Date().toISOString() } : m)));
    try {
      await deleteMessage(id);
    } catch {
      toast.error("Failed to delete message");
      setMessages(previous);
    }
  }

  const lastMineIndex = useMemo(
    () => messages.reduce((acc, m, i) => (m.senderId === meId && !m.deletedAt ? i : acc), -1),
    [messages, meId],
  );

  const renderItems = useMemo(() => {
    const items: Array<
      | { type: "divider"; key: string; label: string }
      | { type: "message"; key: string; message: ClientMessage; tight: boolean; showSeen: boolean }
    > = [];
    let lastDayKey = "";
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]!;
      const d = new Date(m.createdAt);
      const dayKey = d.toDateString();
      if (dayKey !== lastDayKey) {
        items.push({ type: "divider", key: `divider-${dayKey}`, label: dayLabel(d) });
        lastDayKey = dayKey;
      }
      const prev = messages[i - 1];
      const tight = Boolean(
        prev &&
          prev.senderId === m.senderId &&
          new Date(prev.createdAt).toDateString() === dayKey &&
          Math.abs(d.getTime() - new Date(prev.createdAt).getTime()) < GROUP_WINDOW_MS,
      );
      const showSeen = i === lastMineIndex && Boolean(otherLastReadAt) && otherLastReadAt! >= m.createdAt;
      items.push({ type: "message", key: m.id, message: m, tight, showSeen });
    }
    return items;
  }, [messages, lastMineIndex, otherLastReadAt]);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link href="/messages" className="shrink-0 lg:hidden" aria-label="Back to messages">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <MessageAvatar name={targetUser.name} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">{targetUser.name}</span>
            {targetUser.isSuperAdmin && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
          </div>
          <p className="truncate text-xs text-muted-foreground">{targetUser.email}</p>
        </div>
      </div>

      <PrivacyNote userId={meId} />

      {!mounted ? (
        <div className="flex-1" />
      ) : (
        <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-3">
          {loadingMore && <p className="pb-2 text-center text-xs text-muted-foreground">Loading older messages…</p>}

          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-muted-foreground">
              <p className="text-sm font-medium text-foreground">No messages yet. Say hello.</p>
            </div>
          )}

          {renderItems.map((item) =>
            item.type === "divider" ? (
              <div key={item.key} className="my-4 flex items-center justify-center">
                <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  {item.label}
                </span>
              </div>
            ) : (
              <MessageBubble
                key={item.key}
                message={item.message}
                isMine={item.message.senderId === meId}
                tight={item.tight}
                showSeen={item.showSeen}
                onDelete={() => handleDelete(item.message.id)}
                onRetry={() => handleRetry(item.message)}
              />
            ),
          )}
        </div>
      )}

      <Composer
        disabled={readOnly}
        disabledReason="This admin's account is no longer active — you can't send new messages here."
        onSend={handleSend}
        autoFocus={messages.length === 0}
      />
    </div>
  );
}
