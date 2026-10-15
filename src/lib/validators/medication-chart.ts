import { z } from "zod";

export const DOSE_SLOTS = ["morning", "afternoon", "evening", "night"] as const;
export type DoseSlot = (typeof DOSE_SLOTS)[number];

/** Stable key for a prescription item; older items saved without an id fall back to their position. */
export function doseItemKey(item: { id?: string }, index: number): string {
  return item.id || `item-${index}`;
}

export const recordDoseSchema = z
  .object({
    formRecordId: z.string().uuid(),
    itemId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
    slot: z.enum(DOSE_SLOTS),
    given: z.boolean(),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.given || Boolean(v.reason), {
    message: "State the reason the dose was not given",
    path: ["reason"],
  });

export type RecordDoseInput = z.infer<typeof recordDoseSchema>;
