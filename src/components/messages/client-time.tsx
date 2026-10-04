"use client";

import { useEffect, useState } from "react";

/**
 * Renders a local wall-clock time, client-side only. Message timestamps
 * arrive as UTC ISO strings from the server; formatting them with
 * toLocaleTimeString during SSR would use the server's timezone and mismatch
 * the browser's on hydration, so this renders a placeholder until mounted.
 */
export function ClientTime({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [iso]);

  return <>{text ?? " "}</>;
}
