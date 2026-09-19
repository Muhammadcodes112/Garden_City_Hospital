"use client";

import type { AutosaveStatus } from "@/hooks/use-form-autosave";

export function SaveStatus({ status }: { status: AutosaveStatus }) {
  if (status.state === "idle") return null;

  let text = "";
  if (status.state === "saving") text = "Saving…";
  if (status.state === "saved") {
    text = `All changes saved · ${status.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (status.state === "offline") {
    text = status.at
      ? `Offline – saved on this device · ${status.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "Offline – saved on this device";
  }
  if (status.state === "error") text = `Save failed – retrying (${status.message})`;

  return (
    <p
      className="text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      {text}
    </p>
  );
}
