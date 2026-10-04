import { z } from "zod";

export const sendRecordToColleaguesSchema = z.object({
  formRecordId: z.string().uuid(),
  recipientUserIds: z.array(z.string().min(1)).min(1, "Select at least one colleague"),
  note: z.string().trim().max(4000).optional(),
  createExternalLink: z.boolean().default(false),
});

export type SendRecordToColleaguesInput = z.infer<typeof sendRecordToColleaguesSchema>;
