import { z } from "zod";

// Patient identity lives in the `patients` table — this schema validates
// only form_records.data for a type: 'medical_report' record.
export const medicalReportDataSchema = z.object({
  dateOfReport: z.string().optional().default(""),
  reportBody: z.string().optional().default(""),
  doctorName: z.string().optional().default(""),
  doctorTitle: z.string().optional().default(""),
});

export type MedicalReportData = z.infer<typeof medicalReportDataSchema>;
