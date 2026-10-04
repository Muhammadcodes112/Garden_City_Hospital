import { z } from "zod";

export const messageAttachmentInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("form_record"), formRecordId: z.string().uuid() }),
  z.object({ kind: z.literal("share_link"), shareLinkId: z.string().uuid() }),
  z.object({
    kind: z.literal("file"),
    fileUrl: z.string().min(1),
    fileName: z.string().min(1),
    fileSize: z.number().int().nonnegative(),
    mimeType: z.string().min(1),
  }),
]);

export const sendMessageSchema = z
  .object({
    targetUserId: z.string().min(1),
    body: z.string().trim().max(4000).optional(),
    attachment: messageAttachmentInputSchema.optional(),
  })
  .refine((data) => Boolean(data.body?.length) || Boolean(data.attachment), {
    message: "A message needs text, an attachment, or both",
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessageAttachmentInput = z.infer<typeof messageAttachmentInputSchema>;
