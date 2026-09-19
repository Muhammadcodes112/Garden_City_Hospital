import { z } from "zod";
import { doctorSignatureSchema } from "@/lib/validators/lab-request";

export const DOSAGE_FORMS = [
  "tablet",
  "capsule",
  "syrup",
  "injection",
  "cream",
  "drops",
  "suspension",
  "ointment",
  "inhaler",
  "other",
] as const;

export const ROUTES = [
  "oral",
  "IV",
  "IM",
  "topical",
  "sublingual",
  "inhalation",
  "rectal",
  "eye drops",
  "ear drops",
  "other",
] as const;

export const prescriptionItemSchema = z.object({
  id: z.string().optional(),
  drugName: z.string().optional().default(""),
  strength: z.string().optional().default(""),
  dosageForm: z.string().optional().default("tablet"),
  dose: z.string().optional().default(""),
  route: z.string().optional().default("oral"),
  frequency: z.string().optional().default(""),
  duration: z.string().optional().default(""),
  quantity: z.string().optional().default(""),
  instructions: z.string().optional().default(""),
});

export const prescriptionDataSchema = z.object({
  items: z.array(prescriptionItemSchema).default([]),
  prescriberName: z.string().optional().default(""),
  prescriberSignature: doctorSignatureSchema.optional(),
  prescriberDate: z.string().optional().default(""),
  pharmacistName: z.string().optional().default(""),
  pharmacistSignature: doctorSignatureSchema.optional(),
  pharmacistDate: z.string().optional().default(""),
});

export type PrescriptionData = z.infer<typeof prescriptionDataSchema>;
export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>;

export const prescriptionCompleteSchema = prescriptionDataSchema.extend({
  items: z
    .array(prescriptionItemSchema)
    .min(1, "At least one prescription item is required")
    .refine(
      (items) =>
        items.every(
          (item) => item.drugName.trim() && item.dose.trim() && item.frequency.trim(),
        ),
      {
        message:
          "Each prescription item must have a Drug Name, Dose, and Frequency filled in",
      },
    ),
  prescriberName: z.string().min(1, "Prescriber name is required"),
});

export function defaultPrescriptionData(): PrescriptionData {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const formattedDate = `${yyyy}-${mm}-${dd}`;

  return prescriptionDataSchema.parse({
    items: [
      {
        id: crypto.randomUUID(),
        drugName: "",
        strength: "",
        dosageForm: "tablet",
        dose: "",
        route: "oral",
        frequency: "",
        duration: "",
        quantity: "",
        instructions: "",
      },
    ],
    prescriberDate: formattedDate,
  });
}
