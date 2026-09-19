import { z } from "zod";
import { ALL_LAB_TESTS } from "@/lib/lab-tests/catalog";

const validTestIds = new Set(ALL_LAB_TESTS.map((t) => t.id));

export const doctorSignatureSchema = z.object({
  mode: z.enum(["draw", "type"]),
  data: z.string(),
});

export const labRequestDataSchema = z.object({
  provisionalDiagnosis: z.string().optional().default(""),
  collectionDate: z.string().optional().default(""),
  collectionTime: z.string().optional().default(""),
  testsSelected: z
    .array(z.string())
    .default([])
    .refine((ids) => ids.every((id) => validTestIds.has(id)), {
      message: "Unknown test id in selection",
    }),
  referringDoctor: z.string().optional().default(""),
  referringPhone: z.string().optional().default(""),
  doctorSignature: doctorSignatureSchema.optional(),
  hospitalClinic: z.string().optional().default("Garden City Specialist Hospital"),
  formDate: z.string().optional().default(""),
});

export type LabRequestData = z.infer<typeof labRequestDataSchema>;

export const labRequestCompleteSchema = labRequestDataSchema.extend({
  testsSelected: z.array(z.string()).min(1, "Select at least one test"),
  referringDoctor: z.string().min(1, "Referring doctor is required"),
  formDate: z.string().min(1, "Date is required"),
});

export function defaultLabRequestData(): LabRequestData {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return labRequestDataSchema.parse({
    hospitalClinic: "Garden City Specialist Hospital",
    formDate: `${yyyy}-${mm}-${dd}`,
  });
}
