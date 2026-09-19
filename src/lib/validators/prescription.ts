import { z } from "zod";

export const medicationSchema = z.object({
  // No `.min(1)`: "Add drug" inserts a blank row that autosave must be able
  // to persist before the admin has typed a drug name into it.
  drugName: z.string().optional().default(""),
  dosage: z.string().optional().default(""),
  frequency: z.string().optional().default(""),
  duration: z.string().optional().default(""),
  quantity: z.string().optional().default(""),
  instructions: z.string().optional().default(""),
});

// Patient identity lives in the `patients` table — this schema validates
// only form_records.data for a type: 'prescription' record. `weight` stays
// here (not in `patients`) because it's a per-visit vital, not a fixed
// patient attribute.
export const prescriptionDataSchema = z.object({
  weight: z.string().optional().default(""),
  dateIssued: z.string().optional().default(""),

  medications: z.array(medicationSchema).default([]),
  notes: z.string().optional().default(""),

  doctorName: z.string().optional().default(""),
  doctorTitle: z.string().optional().default(""),
});

export type PrescriptionData = z.infer<typeof prescriptionDataSchema>;
export type MedicationInput = z.infer<typeof medicationSchema>;
