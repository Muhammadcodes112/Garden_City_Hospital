import { z } from "zod";
import { labRequestDataSchema } from "./lab-request";
import { prescriptionDataSchema } from "./prescription";
import { medicalReportDataSchema } from "./medical-report";

export const FORM_TYPES = ["lab", "prescription", "medical_report"] as const;
export type FormType = (typeof FORM_TYPES)[number];

const schemaByType = {
  lab: labRequestDataSchema,
  prescription: prescriptionDataSchema,
  medical_report: medicalReportDataSchema,
} satisfies Record<FormType, z.ZodTypeAny>;

/** Returns the Zod schema that validates form_records.data for a given type. */
export function formDataSchema(type: FormType) {
  return schemaByType[type];
}
