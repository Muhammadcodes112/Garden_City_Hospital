import { z } from "zod";
import { NIGERIAN_PHONE_MESSAGE, isValidNigerianPhone } from "@/lib/validators/phone";

const phoneField = z
  .string()
  .optional()
  .default("")
  .refine((val) => val === "" || isValidNigerianPhone(val), NIGERIAN_PHONE_MESSAGE);

export const draftPatientSchema = z.object({
  surname: z.string().optional().default(""),
  firstNames: z.string().optional().default(""),
  age: z.string().optional().default(""),
  sex: z.string().optional().default(""),
  phone: phoneField,
  address: z.string().optional().default(""),
  hospitalNumber: z.string().min(1, "Hospital number is required"),
});

export const patientSchema = z.object({
  surname: z.string().min(1, "Surname is required"),
  firstNames: z.string().min(1, "First name(s) required"),
  age: z.string().optional().default(""),
  sex: z.string().optional().default(""),
  phone: phoneField,
  address: z.string().optional().default(""),
  hospitalNumber: z.string().min(1, "Hospital number is required"),
});

export type PatientInput = z.infer<typeof patientSchema>;
