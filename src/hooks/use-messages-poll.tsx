"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import type { PersonSummary, SerializedMessage } from "@/lib/messages";

type PollResponse = {
  serverTime: string;
  people: PersonSummary[];
  unreadTotal: number;
  messages: SerializedMessage[];
};

type MessagesPollContextValue = {
  people: PersonSummary[];
  unreadTotal: number;
  lastUpdates: SerializedMessage[];
  updateTick: number;
  ready: boolean;
  refreshNow: () => void;
};

const MessagesPollContext = createContext<MessagesPollContextValue | null>(null);

const POLL_INTERVAL_MS = 4000;
const BASE_TITLE = "Garden City Specialist Hospital — Admin";

export function MessagesPollProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const meId = session?.user?.id;
  const pathname = usePathname();
  const router = useRouter();

  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [lastUpdates, setLastUpdates] = useState<SerializedMessage[]>([]);
  const [updateTick, setUpdateTick] = useState(0);
  const [ready, setReady] = useState(false);

  // Start the cursor at "now" so the first poll never replays pre-existing
  // history as if it just arrived (no toast flood / false "new" messages).
  const cursorRef = useRef<string>(new Date().toISOString());
  const pathnameRef = useRef(pathname);
  const peopleRef = useRef<PersonSummary[]>([]);
  const inFlightRef = useRef(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const poll = useCallback(async () => {
    if (!meId || inFlightRef.current) return;
    if (document.visibilityState !== "visible") return;
    inFlightRef.current = true;
    try {
      const res = await fetch(`/api/messages/poll?since=${encodeURIComponent(cursorRef.current)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data: PollResponse = await res.json();

      const incomingBySender = new Map<string, number>();
      for (const msg of data.messages) {
        if (msg.senderId === meId || msg.deletedAt) continue;
        if (pathnameRef.current === `/messages/${msg.senderId}`) continue;
        incomingBySender.set(msg.senderId, (incomingBySender.get(msg.senderId) ?? 0) + 1);
      }
      for (const [senderId, count] of incomingBySender) {
        const sender = data.people.find((p) => p.id === senderId);
        toast(sender?.name ?? "New message", {
          description: count > 1 ? `Sent ${count} new messages` : "Sent you a message",
          action: { label: "Open", onClick: () => router.push(`/messages/${senderId}`) },
        });
      }

      peopleRef.current = data.people;
      setPeople(data.people);
      setUnreadTotal(data.unreadTotal);
      if (data.messages.length > 0) {
        setLastUpdates(data.messages);
        setUpdateTick((t) => t + 1);
      }
      cursorRef.current = data.serverTime;
      setReady(true);
    } catch {
      // Silent — the next interval tick retries.
    } finally {
      inFlightRef.current = false;
    }
  }, [meId, router]);

  useEffect(() => {
    if (!meId) return;
    void poll();
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") void poll();
    }
    function onFocus() {
      void poll();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [meId, poll]);

  useEffect(() => {
    document.title = unreadTotal > 0 ? `(${unreadTotal}) ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [unreadTotal]);

  return (
    <MessagesPollContext.Provider value={{ people, unreadTotal, lastUpdates, updateTick, ready, refreshNow: poll }}>
      {children}
    </MessagesPollContext.Provider>
  );
}

export function useMessagesPoll() {
  const ctx = useContext(MessagesPollContext);
  if (!ctx) throw new Error("useMessagesPoll must be used within MessagesPollProvider");
  return ctx;
}
