"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  autosaveStorageKey,
  clearAutosaveMirror,
  readAutosaveMirror,
  writeAutosaveMirror,
} from "@/lib/forms/autosave-storage";

export type AutosaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; at: Date }
  | { state: "offline"; at: Date | null }
  | { state: "error"; message: string };

type UseFormAutosaveOptions<TPayload> = {
  formType: string;
  recordId: string;
  enabled: boolean;
  getPayload: () => TPayload;
  serverUpdatedAt: string | null;
  onSave: (payload: TPayload) => Promise<{ updatedAt: string }>;
  debounceMs?: number;
};

function stableStringify(value: unknown) {
  return JSON.stringify(value);
}

export function useFormAutosave<TPayload>({
  formType,
  recordId,
  enabled,
  getPayload,
  serverUpdatedAt,
  onSave,
  debounceMs = 1500,
}: UseFormAutosaveOptions<TPayload>) {
  const [status, setStatus] = useState<AutosaveStatus>({ state: "idle" });
  const lastSavedRef = useRef<string>("");
  const lastServerAtRef = useRef<string | null>(serverUpdatedAt);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = autosaveStorageKey(formType, recordId);

  lastServerAtRef.current = serverUpdatedAt;

  const persistLocal = useCallback(
    (payload: TPayload) => {
      writeAutosaveMirror(storageKey, {
        recordId,
        payload,
        savedAt: new Date().toISOString(),
        serverUpdatedAt: lastServerAtRef.current,
      });
    },
    [recordId, storageKey],
  );

  const flushSave = useCallback(
    async (reason: "debounced" | "immediate") => {
      if (!enabled || savingRef.current) return;
      const payload = getPayload();
      const serialized = stableStringify(payload);
      if (serialized === lastSavedRef.current) return;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        persistLocal(payload);
        setStatus({ state: "offline", at: new Date() });
        return;
      }

      savingRef.current = true;
      setStatus({ state: "saving" });
      try {
        const result = await onSave(payload);
        lastSavedRef.current = serialized;
        lastServerAtRef.current = result.updatedAt;
        persistLocal(payload);
        clearAutosaveMirror(storageKey);
        setStatus({ state: "saved", at: new Date() });
      } catch (err) {
        persistLocal(payload);
        const message = err instanceof Error ? err.message : "Save failed";
        setStatus({ state: "error", message });
        if (reason === "debounced" && !retryRef.current) {
          retryRef.current = setTimeout(() => {
            retryRef.current = null;
            void flushSave("debounced");
          }, 5000);
        }
      } finally {
        savingRef.current = false;
      }
    },
    [enabled, getPayload, onSave, persistLocal, storageKey],
  );

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushSave("debounced"), debounceMs);
  }, [debounceMs, flushSave]);

  useEffect(() => {
    lastSavedRef.current = stableStringify(getPayload());
  }, [getPayload]);

  useEffect(() => {
    if (!enabled) return;

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        void flushSave("immediate");
      }
    }
    function onOnline() {
      void flushSave("immediate");
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled, flushSave]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  const restoreFromLocalIfNewer = useCallback((): TPayload | null => {
    const mirror = readAutosaveMirror<TPayload>(storageKey);
    if (!mirror) return null;
    const serverAt = lastServerAtRef.current ? new Date(lastServerAtRef.current).getTime() : 0;
    const localAt = new Date(mirror.savedAt).getTime();
    if (localAt > serverAt) return mirror.payload;
    return null;
  }, [storageKey]);

  return {
    status,
    scheduleSave,
    flushSave: () => flushSave("immediate"),
    restoreFromLocalIfNewer,
  };
}
