export type AutosaveMirror<T> = {
  recordId: string;
  payload: T;
  savedAt: string;
  serverUpdatedAt: string | null;
};

export function autosaveStorageKey(formType: string, recordId: string) {
  return `gch-autosave-${formType}-${recordId}`;
}

export function readAutosaveMirror<T>(key: string): AutosaveMirror<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as AutosaveMirror<T>;
  } catch {
    return null;
  }
}

export function writeAutosaveMirror<T>(key: string, mirror: AutosaveMirror<T>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(mirror));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function clearAutosaveMirror(key: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}
