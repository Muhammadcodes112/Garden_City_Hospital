"use client";

const HISTORY_KEY = "gch_clinical_doctor_history";
const DELETED_KEY = "gch_clinical_deleted_items";
const EVENT_NAME = "gch-clinical-history-updated";
const MAX_HISTORY_ITEMS = 200;

export function getClinicalHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string" && Boolean(x.trim())) : [];
  } catch (err) {
    console.error("Failed to read clinical history:", err);
    return [];
  }
}

export function getDeletedItems(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map((x) => String(x).toLowerCase().trim()) : []);
  } catch {
    return new Set();
  }
}

/**
 * Saves a clinical note or diagnosis to doctor history.
 * Handles single terms ("Hypertension") or multiple terms ("Malaria, Typhoid, Gastritis").
 */
export function saveToClinicalHistory(rawText: string): void {
  if (typeof window === "undefined") return;
  const trimmed = rawText.trim();
  if (!trimmed || trimmed.length < 2) return;

  // Split lines or comma-separated items if present, but also preserve cohesive sentences
  const candidates: string[] = [];
  const lines = trimmed.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // If line has comma-separated items and each is short (e.g. "Malaria, Typhoid fever")
    if (line.includes(",") && line.length < 120) {
      const parts = line.split(",").map((p) => p.trim()).filter((p) => p.length >= 2 && p.length <= 80);
      candidates.push(...parts);
    } else {
      candidates.push(line);
    }
  }

  if (candidates.length === 0) return;

  try {
    const current = getClinicalHistory();
    const existingLower = new Set(current.map((x) => x.toLowerCase()));

    const next = [...current];
    for (const item of candidates) {
      const clean = item.replace(/^[•\-\*]\s*/, "").trim();
      if (clean.length < 2 || clean.length > 250) continue;
      const lower = clean.toLowerCase();

      // Remove previous occurrence if any, to bump to top
      const idx = next.findIndex((x) => x.toLowerCase() === lower);
      if (idx !== -1) {
        next.splice(idx, 1);
      }
      next.unshift(clean);
      existingLower.add(lower);
    }

    const trimmedList = next.slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedList));

    // Un-delete if it was previously hidden
    const deleted = getDeletedItems();
    let deletedChanged = false;
    for (const c of candidates) {
      const l = c.toLowerCase();
      if (deleted.has(l)) {
        deleted.delete(l);
        deletedChanged = true;
      }
    }
    if (deletedChanged) {
      localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(deleted)));
    }

    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch (err) {
    console.error("Failed to save to clinical history:", err);
  }
}

/**
 * Removes an item from the doctor's custom history.
 * If it was a default item, marks it as hidden.
 */
export function removeFromClinicalHistory(item: string): void {
  if (typeof window === "undefined") return;
  const targetLower = item.toLowerCase().trim();
  if (!targetLower) return;

  try {
    const current = getClinicalHistory();
    const filtered = current.filter((x) => x.toLowerCase().trim() !== targetLower);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));

    const deleted = getDeletedItems();
    deleted.add(targetLower);
    localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(deleted)));

    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch (err) {
    console.error("Failed to remove from clinical history:", err);
  }
}

export function subscribeClinicalHistory(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}
