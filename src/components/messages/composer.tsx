"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-is-mobile";

export function Composer({
  disabled,
  disabledReason,
  onSend,
  autoFocus,
}: {
  disabled?: boolean;
  disabledReason?: string;
  onSend: (body: string) => void;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled || !isOnline) return;
    onSend(trimmed);
    setValue("");
    requestAnimationFrame(autoGrow);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || isMobile) return;
    e.preventDefault();
    submit();
  }

  if (disabled) {
    return (
      <div className="border-t border-border bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
        {disabledReason ?? "This conversation is read-only."}
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card p-3">
      {!isOnline && (
        <p className="mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">
          You&apos;re offline — messages can&apos;t be sent right now.
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoGrow();
          }}
          onKeyDown={handleKeyDown}
          disabled={!isOnline}
          placeholder="Type a message..."
          rows={1}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          type="button"
          size="icon"
          onClick={submit}
          disabled={!value.trim() || !isOnline}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
