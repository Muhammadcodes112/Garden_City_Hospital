import { z } from "zod";

export const PAYMENT_MODES = ["cash", "transfer", "pos", "cheque"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: "Cash",
  transfer: "Transfer",
  pos: "POS",
  cheque: "Cheque",
};

/** Receipt numbers print zero-padded to 7 digits, like the paper book (0037441). */
export function formatReceiptNo(n: number): string {
  return n.toString().padStart(7, "0");
}

export const receiptLineInputSchema = z.object({
  // null = a free-typed item with no catalogue entry.
  serviceId: z.string().uuid().nullable(),
  qty: z.number().int().min(1, "Quantity must be at least 1").max(999),
  // Only used for free items and services that allow a typed amount ("Others"); naira text, e.g. "2,500".
  amount: z.string().trim().max(20).optional(),
  // Only used for free items and "Others": what the payment is for.
  description: z.string().trim().max(200).optional(),
});

export const issueReceiptSchema = z
  .object({
    patientId: z.string().uuid().nullable(),
    payerName: z.string().trim().min(1, "Enter who the money was received from").max(120),
    paymentMode: z.enum(PAYMENT_MODES),
    tellerOrTransferRef: z.string().trim().max(80).optional(),
    chequeNo: z.string().trim().max(40).optional(),
    lines: z.array(receiptLineInputSchema).min(1, "Add at least one item").max(50),
  })
  .refine((v) => v.paymentMode !== "cheque" || Boolean(v.chequeNo), {
    message: "Enter the cheque number",
    path: ["chequeNo"],
  });

export type IssueReceiptInput = z.infer<typeof issueReceiptSchema>;
export type ReceiptLineInput = z.infer<typeof receiptLineInputSchema>;
