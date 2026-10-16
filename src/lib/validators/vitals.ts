import { z } from "zod";

const optionalInt = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= min && v <= max), {
      message: `${label} must be a whole number between ${min} and ${max}`,
    });

// Ranges are wide on purpose: they catch typos (e.g. 377 for 37.7), not abnormal-but-real readings.
export const recordVitalsSchema = z
  .object({
    patientId: z.string().uuid(),
    bloodPressure: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || /^\d{2,3}\/\d{2,3}$/.test(v), { message: "Blood pressure must look like 120/80" }),
    pulse: optionalInt(20, 250, "Pulse"),
    temperature: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || (/^\d{2}(\.\d)?$/.test(v) && Number(v) >= 30 && Number(v) <= 45), {
        message: "Temperature must be in °C between 30 and 45, e.g. 37.2",
      }),
    spo2: optionalInt(50, 100, "SpO₂"),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.bloodPressure || v.pulse !== undefined || v.temperature || v.spo2 !== undefined, {
    message: "Enter at least one vital sign",
  });

export type RecordVitalsInput = z.input<typeof recordVitalsSchema>;
