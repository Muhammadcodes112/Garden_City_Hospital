import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getCashierDb } from "@/db/cashier";
import {
  cashierShifts,
  patients,
  receiptLines,
  receipts,
  serviceCategories,
  services,
  user,
} from "@/db/schema";
import { logEvent } from "@/lib/activity";
import { nairaAmountInWords } from "@/lib/amount-words";
import { MAX_PRICE_KOBO, formatKobo, parseNairaToKobo } from "@/lib/money";
import { CASHIER_VOID_WINDOW_HOURS, SHIFT_VOID_ALERT_THRESHOLD, isWithinCashierVoidWindow } from "@/lib/cashier-policy";
import { PAYMENT_MODES, formatReceiptNo, issueReceiptSchema, type PaymentMode } from "@/lib/validators/cashier";

/**
 * Receipt issue/void rules and shift-report building, shared by the cashier
 * API routes and server actions. Everything runs on the restricted
 * cashier_app connection (src/db/cashier.ts). Functions return an HTTP-style
 * status so the routes can answer 403/404/409 exactly.
 */

type CashierRole = "cashier" | "super_admin";
type Actor = { id: string; name: string; role: CashierRole };
export type ServiceResult<T> = { status: 200; body: T } | { status: 400 | 403 | 404 | 409; body: { error: string } };

const fail = (status: 400 | 403 | 404 | 409, error: string) => ({ status, body: { error } }) as const;

function actorFields(a: Actor) {
  return { actorId: a.id, actorLabel: a.name, actorRoleAtTime: a.role };
}

export async function openShiftOf(cashierId: string) {
  const [shift] = await getCashierDb()
    .select({ id: cashierShifts.id })
    .from(cashierShifts)
    .where(and(eq(cashierShifts.cashierId, cashierId), eq(cashierShifts.status, "open")));
  return shift ?? null;
}

// ---------------------------------------------------------------------------
// Issue
// ---------------------------------------------------------------------------

export async function issueReceiptAs(actor: Actor, input: unknown): Promise<ServiceResult<{ receiptId: string; receiptNo: string }>> {
  if (actor.role !== "cashier") return fail(403, "Only cashier accounts issue receipts");
  const parsed = issueReceiptSchema.safeParse(input);
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid receipt");
  const v = parsed.data;

  const shift = await openShiftOf(actor.id);
  if (!shift) return fail(409, "Start a shift before issuing receipts");

  const db = getCashierDb();
  if (v.patientId) {
    const [p] = await db.select({ id: patients.id }).from(patients).where(eq(patients.id, v.patientId));
    if (!p) return fail(404, "That patient no longer exists");
  }

  // Prices come from the catalogue, never the browser, except services that
  // allow a typed amount ("Others") and free items.
  const serviceIds = [...new Set(v.lines.map((l) => l.serviceId).filter((id): id is string => Boolean(id)))];
  const catalogue = serviceIds.length
    ? await db
        .select({ id: services.id, name: services.name, priceKobo: services.priceKobo, allowCustomAmount: services.allowCustomAmount, active: services.active })
        .from(services)
        .where(inArray(services.id, serviceIds))
    : [];
  const byId = new Map(catalogue.map((s) => [s.id, s]));

  const lines: { serviceId: string | null; description: string; qty: number; unitPriceKobo: number; lineTotalKobo: number }[] = [];
  for (const l of v.lines) {
    const svc = l.serviceId ? byId.get(l.serviceId) : undefined;
    if (l.serviceId && (!svc || !svc.active)) return fail(400, "An item on this receipt is no longer on the price list");
    let unitPriceKobo: number;
    let description: string;
    if (!svc || svc.allowCustomAmount) {
      const amount = l.amount ? parseNairaToKobo(l.amount) : null;
      if (!amount) return fail(400, `Enter an amount for ${svc?.name ?? "the free item"}`);
      unitPriceKobo = amount;
      description = l.description ? (svc ? `${svc.name}: ${l.description}` : l.description) : svc?.name ?? "";
      if (!description) return fail(400, "Describe the free item");
    } else {
      if (svc.priceKobo <= 0) return fail(400, `${svc.name} has no price yet. Ask a Super Admin to set it.`);
      unitPriceKobo = svc.priceKobo;
      description = svc.name;
    }
    lines.push({ serviceId: svc?.id ?? null, description, qty: l.qty, unitPriceKobo, lineTotalKobo: unitPriceKobo * l.qty });
  }

  const totalKobo = lines.reduce((sum, l) => sum + l.lineTotalKobo, 0);
  if (totalKobo <= 0) return fail(400, "The receipt total must be more than ₦0");
  if (totalKobo > MAX_PRICE_KOBO) return fail(400, `A single receipt can't exceed ${formatKobo(MAX_PRICE_KOBO)}`);

  const ref = v.paymentMode === "transfer" || v.paymentMode === "pos" ? v.tellerOrTransferRef || null : null;
  const chequeNo = v.paymentMode === "cheque" ? v.chequeNo || null : null;

  const created = await db.transaction(async (tx) => {
    // receipt_no defaults to nextval('receipt_no_seq'): unique under concurrency, never reused.
    const [r] = await tx
      .insert(receipts)
      .values({
        patientId: v.patientId,
        payerName: v.payerName,
        totalKobo,
        amountInWords: nairaAmountInWords(totalKobo),
        paymentMode: v.paymentMode,
        tellerOrTransferRef: ref,
        chequeNo,
        shiftId: shift.id,
        issuedBy: actor.id,
      })
      .returning({ id: receipts.id, receiptNo: receipts.receiptNo });
    await tx.insert(receiptLines).values(lines.map((l) => ({ ...l, receiptId: r!.id })));
    await logEvent({
      tx,
      category: "billing",
      action: "receipt.issued",
      summary: `${actor.name} issued receipt ${formatReceiptNo(r!.receiptNo)} to ${v.payerName} for ${formatKobo(totalKobo)} (${v.paymentMode})`,
      ...actorFields(actor),
      targetType: "receipt",
      targetId: r!.id,
      metadata: { receiptNo: r!.receiptNo, totalKobo, paymentMode: v.paymentMode, patientId: v.patientId, shiftId: shift.id },
    });
    return r!;
  });

  return { status: 200, body: { receiptId: created.id, receiptNo: formatReceiptNo(created.receiptNo) } };
}

// ---------------------------------------------------------------------------
// Void
// ---------------------------------------------------------------------------

/**
 * A cashier may void only their own receipt, in their currently open shift,
 * within CASHIER_VOID_WINDOW_HOURS of issue. A Super Admin may void any
 * receipt of any age; that is logged as a privileged action. A reason is
 * always required, and the receipt keeps its number and stays on reports.
 */
export async function voidReceiptAs(actor: Actor, receiptId: string, reason: unknown): Promise<ServiceResult<{ voided: true }>> {
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  if (trimmed.length < 3) return fail(400, "A void needs a typed reason");
  if (!/^[0-9a-f-]{36}$/i.test(receiptId)) return fail(404, "Receipt not found");

  const db = getCashierDb();
  const [r] = await db
    .select({
      receiptNo: receipts.receiptNo,
      status: receipts.status,
      shiftId: receipts.shiftId,
      issuedBy: receipts.issuedBy,
      issuedAt: receipts.issuedAt,
      totalKobo: receipts.totalKobo,
    })
    .from(receipts)
    .where(eq(receipts.id, receiptId));
  if (!r) return fail(404, "Receipt not found");
  if (r.status === "voided") return fail(409, "This receipt is already voided");

  if (actor.role === "cashier") {
    if (r.issuedBy !== actor.id) return fail(403, "You can only void your own receipts. Ask a super admin.");
    const shift = await openShiftOf(actor.id);
    if (!shift || r.shiftId !== shift.id) return fail(403, "This receipt is not in your open shift. Ask a super admin.");
    if (!isWithinCashierVoidWindow(r.issuedAt)) {
      return fail(403, `Receipts older than ${CASHIER_VOID_WINDOW_HOURS} hours can only be voided by a super admin.`);
    }
  }

  const privileged = actor.role === "super_admin";
  await db.transaction(async (tx) => {
    await tx
      .update(receipts)
      .set({ status: "voided", voidedBy: actor.id, voidedAt: new Date(), voidReason: trimmed })
      .where(and(eq(receipts.id, receiptId), eq(receipts.status, "issued")));
    await logEvent({
      tx,
      category: "billing",
      action: privileged ? "receipt.voided_privileged" : "receipt.voided",
      summary: `${actor.name}${privileged ? " (super admin, privileged)" : ""} voided receipt ${formatReceiptNo(r.receiptNo)} (${formatKobo(r.totalKobo)}): ${trimmed}`,
      ...actorFields(actor),
      targetType: "receipt",
      targetId: receiptId,
      metadata: { receiptNo: r.receiptNo, totalKobo: r.totalKobo, reason: trimmed, privileged, issuedBy: r.issuedBy, shiftId: r.shiftId },
    });
  });
  return { status: 200, body: { voided: true } };
}

// ---------------------------------------------------------------------------
// Shift report snapshot
// ---------------------------------------------------------------------------

export type ShiftReportSnapshot = {
  version: 1;
  generatedAt: string;
  shift: {
    id: string;
    cashierId: string;
    cashierName: string;
    openedAt: string;
    closedAt: string | null;
    durationMinutes: number;
  };
  totals: { issuedCount: number; issuedKobo: number; voidCount: number; voidKobo: number };
  voidAlert: boolean;
  byMode: Record<PaymentMode, { count: number; totalKobo: number }>;
  byCategory: { category: string; totalKobo: number }[];
  receipts: {
    receiptNo: string;
    issuedAt: string;
    payerName: string;
    services: string;
    paymentMode: PaymentMode;
    totalKobo: number;
    status: "issued" | "voided";
    voidReason: string | null;
    voidedByName: string | null;
  }[];
  cash: {
    openingFloatKobo: number;
    cashTakenKobo: number;
    expectedCashKobo: number;
    countedCashKobo: number | null;
    varianceKobo: number | null;
    closingNote: string | null;
  };
};

type Db = ReturnType<typeof getCashierDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Computes a shift's report from live data. Voided receipts stay in the
 * receipt list (struck through, with reason) and are counted separately;
 * they are subtracted from every total, never hidden.
 */
export async function buildShiftReport(
  client: Db | Tx,
  shiftId: string,
  closing?: { countedCashKobo: number; closingNote: string | null; closedAt: Date },
): Promise<ShiftReportSnapshot | null> {
  const [shift] = await client
    .select({
      id: cashierShifts.id,
      cashierId: cashierShifts.cashierId,
      cashierName: user.name,
      openedAt: cashierShifts.openedAt,
      closedAt: cashierShifts.closedAt,
      openingFloatKobo: cashierShifts.openingFloatKobo,
      countedCashKobo: cashierShifts.countedCashKobo,
      closingNote: cashierShifts.closingNote,
    })
    .from(cashierShifts)
    .innerJoin(user, eq(cashierShifts.cashierId, user.id))
    .where(eq(cashierShifts.id, shiftId));
  if (!shift) return null;

  const voider = alias(user, "voider");
  const rows = await client
    .select({
      id: receipts.id,
      receiptNo: receipts.receiptNo,
      issuedAt: receipts.issuedAt,
      payerName: receipts.payerName,
      paymentMode: receipts.paymentMode,
      totalKobo: receipts.totalKobo,
      status: receipts.status,
      voidReason: receipts.voidReason,
      voidedByName: voider.name,
    })
    .from(receipts)
    .leftJoin(voider, eq(receipts.voidedBy, voider.id))
    .where(eq(receipts.shiftId, shiftId))
    .orderBy(asc(receipts.issuedAt));

  const lineRows = rows.length
    ? await client
        .select({
          receiptId: receiptLines.receiptId,
          description: receiptLines.description,
          qty: receiptLines.qty,
          lineTotalKobo: receiptLines.lineTotalKobo,
          category: serviceCategories.name,
        })
        .from(receiptLines)
        .leftJoin(services, eq(receiptLines.serviceId, services.id))
        .leftJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
        .where(inArray(receiptLines.receiptId, rows.map((r) => r.id)))
    : [];

  const byMode = Object.fromEntries(PAYMENT_MODES.map((m) => [m, { count: 0, totalKobo: 0 }])) as ShiftReportSnapshot["byMode"];
  const issued = rows.filter((r) => r.status === "issued");
  const voided = rows.filter((r) => r.status === "voided");
  for (const r of issued) {
    byMode[r.paymentMode].count++;
    byMode[r.paymentMode].totalKobo += r.totalKobo;
  }

  const issuedIds = new Set(issued.map((r) => r.id));
  const catTotals = new Map<string, number>();
  for (const l of lineRows) {
    if (!issuedIds.has(l.receiptId)) continue;
    const cat = l.category ?? "Free items";
    catTotals.set(cat, (catTotals.get(cat) ?? 0) + l.lineTotalKobo);
  }

  const servicesByReceipt = new Map<string, string[]>();
  for (const l of lineRows) {
    const list = servicesByReceipt.get(l.receiptId) ?? [];
    list.push(l.qty > 1 ? `${l.description} ×${l.qty}` : l.description);
    servicesByReceipt.set(l.receiptId, list);
  }

  const cashTakenKobo = byMode.cash.totalKobo;
  const expectedCashKobo = shift.openingFloatKobo + cashTakenKobo;
  const counted = closing ? closing.countedCashKobo : shift.countedCashKobo;
  const closedAt = closing ? closing.closedAt : shift.closedAt;
  const end = closedAt ?? new Date();

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    shift: {
      id: shift.id,
      cashierId: shift.cashierId,
      cashierName: shift.cashierName,
      openedAt: shift.openedAt.toISOString(),
      closedAt: closedAt ? closedAt.toISOString() : null,
      durationMinutes: Math.max(0, Math.round((end.getTime() - shift.openedAt.getTime()) / 60_000)),
    },
    totals: {
      issuedCount: issued.length,
      issuedKobo: issued.reduce((s, r) => s + r.totalKobo, 0),
      voidCount: voided.length,
      voidKobo: voided.reduce((s, r) => s + r.totalKobo, 0),
    },
    voidAlert: voided.length > SHIFT_VOID_ALERT_THRESHOLD,
    byMode,
    byCategory: [...catTotals.entries()].map(([category, totalKobo]) => ({ category, totalKobo })).sort((a, b) => b.totalKobo - a.totalKobo),
    receipts: rows.map((r) => ({
      receiptNo: formatReceiptNo(r.receiptNo),
      issuedAt: r.issuedAt.toISOString(),
      payerName: r.payerName,
      services: (servicesByReceipt.get(r.id) ?? []).join(", "),
      paymentMode: r.paymentMode,
      totalKobo: r.totalKobo,
      status: r.status,
      voidReason: r.voidReason,
      voidedByName: r.voidedByName,
    })),
    cash: {
      openingFloatKobo: shift.openingFloatKobo,
      cashTakenKobo,
      expectedCashKobo,
      countedCashKobo: counted,
      varianceKobo: counted === null ? null : counted - expectedCashKobo,
      closingNote: closing ? closing.closingNote : shift.closingNote,
    },
  };
}

