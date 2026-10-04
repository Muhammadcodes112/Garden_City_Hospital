"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function PrivacyNote({ userId }: { userId: string }) {
  const storageKey = `messages-privacy-note-dismissed-${userId}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-2 border-b border-border bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-300">
      <span className="flex-1">Patient details shared here are stored in the hospital&apos;s database.</span>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(storageKey, "1");
          setDismissed(true);
        }}
        className="shrink-0 text-amber-700 hover:text-amber-900 dark:text-amber-400"
        aria-label="Dismiss note"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
