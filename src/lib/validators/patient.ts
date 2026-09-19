import { z } from "zod";

export const draftPatientSchema = z.object({
  surname: z.string().optional().default(""),
  firstNames: z.string().optional().default(""),
  age: z.string().optional().default(""),
  sex: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  hospitalNumber: z.string().min(1, "Hospital number is required"),
});

export const patientSchema = z.object({
  surname: z.string().min(1, "Surname is required"),
  firstNames: z.string().min(1, "First name(s) required"),
  age: z.string().optional().default(""),
  sex: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  hospitalNumber: z.string().min(1, "Hospital number is required"),
});

export type PatientInput = z.infer<typeof patientSchema>;
