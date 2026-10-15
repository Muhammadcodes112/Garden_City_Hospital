import { z } from "zod";

export const sendRecordToColleaguesSchema = z.object({
  formRecordId: z.string().uuid(),
  recipientUserIds: z.array(z.string().min(1)).min(1, "Select at least one colleague"),
  note: z.string().trim().max(4000).optional(),
  createExternalLink: z.boolean().default(false),
});

export type SendRecordToColleaguesInput = z.infer<typeof sendRecordToColleaguesSchema>;

export const sendRecordsToColleaguesSchema = z.object({
  formRecordIds: z.array(z.string().uuid()).min(1, "Select at least one record"),
  recipientUserIds: z.array(z.string().min(1)).min(1, "Select at least one colleague"),
  note: z.string().trim().max(4000).optional(),
});

export type SendRecordsToColleaguesInput = z.infer<typeof sendRecordsToColleaguesSchema>;

export const sendPatientFilesToColleaguesSchema = z.object({
  patientIds: z.array(z.string().uuid()).min(1, "Select at least one patient file"),
  recipientUserIds: z.array(z.string().min(1)).min(1, "Select at least one colleague"),
  note: z.string().trim().max(4000).optional(),
});

export type SendPatientFilesToColleaguesInput = z.infer<typeof sendPatientFilesToColleaguesSchema>;
