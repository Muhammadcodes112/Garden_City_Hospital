"use server";

import { and, asc, desc, eq, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db as mainDb } from "@/db";
import { getCashierDb } from "@/db/cashier";
import {
  cashierShifts,
  patients,
  receiptPrints,
  receipts,
  serviceCategories,
  services,
  shiftReports,
  user,
} from "@/db/schema";
import { requireCashierArea } from "@/lib/authz";
import { logEvent } from "@/lib/activity";
import { formatKobo, parseNairaToKobo, MAX_PRICE_KOBO } from "@/lib/money";
import { STALE_SHIFT_HOURS, describeVariance, isWithinCashierVoidWindow } from "@/lib/cashier-policy";
import { buildShiftReport, openShiftOf, type ShiftReportSnapshot } from "@/lib/cashier-service";
import { getOrCreateDmConversation, insertMessageWithAttachment } from "@/lib/messages";
import { emailProvider } from "@/lib/notifications/email";
import { formatReceiptNo, type PaymentMode } from "@/lib/validators/cashier";

// Everything here runs through getCashierDb() — the restricted cashier_app
// Postgres role — so patients/user can only ever be read via the explicit
// columns that role is granted (see scripts/setup-cashier-role.ts). The one
// exception is sendShiftReport, which uses the main connection to look up
// Super Admin emails and post the in-app message.

type Fail = { success: false; error: string };

export type ShiftSummary = {
  id: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  status: "open" | "closed";
  openingFloatKobo: number;
  varianceKobo: number | null;
  reportSentAt: string | null;
  receiptCount: number;
  voidedCount: number;
  totalKobo: number;
  /** Open longer than STALE_SHIFT_HOURS: someone probably forgot to close it. */
  stale: boolean;
};

export type ReceiptSummary = {
  id: string;
  receiptNo: string;
  payerName: string;
  totalKobo: number;
  paymentMode: PaymentMode;
  issuedAt: string;
  issuedByName: string;
  status: "issued" | "voided";
  voidReason: string | null;
  printCount: number;
  /** Whether the current viewer may void it (the server re-checks on void). */
  canVoid: boolean;
};

export type CashierPatient = {
  id: string;
  surname: string;
  firstNames: string;
  hospitalNumber: string;
  age: string;
  sex: string;
  phone: string;
};

export type SaleService = {
  id: string;
  name: string;
  priceKobo: number;
  folderColour: string | null;
  allowCustomAmount: boolean;
};

export type SaleCategory = { id: string; name: string; services: SaleService[] };

export type ShiftReportView = {
  snapshot: ShiftReportSnapshot;
  /** true = the immutable snapshot stored at close; false = live figures for a still-open shift. */
  stored: boolean;
  reportSentAt: string | null;
  canSend: boolean;
};

function actor(session: Awaited<ReturnType<typeof requireCashierArea>>["session"], role: "cashier" | "super_admin") {
  return { actorId: session.user.id, actorLabel: session.user.name, actorRoleAtTime: role };
}

/** Shift totals count issued receipts only; voided ones are counted separately. */
async function summariseShifts(shiftIds: string[]) {
  const out = new Map<string, { receiptCount: number; voidedCount: number; totalKobo: number }>();
  if (shiftIds.length === 0) return out;
  const rows = await getCashierDb()
    .select({
      shiftId: receipts.shiftId,
      receiptCount: sql<number>`count(*) filter (where ${receipts.status} = 'issued')::int`,
      voidedCount: sql<number>`count(*) filter (where ${receipts.status} = 'voided')::int`,
      totalKobo: sql<number>`coalesce(sum(${receipts.totalKobo}) filter (where ${receipts.status} = 'issued'), 0)::bigint`,
    })
    .from(receipts)
    .where(inArray(receipts.shiftId, shiftIds))
    .groupBy(receipts.shiftId);
  for (const r of rows) out.set(r.shiftId, { receiptCount: r.receiptCount, voidedCount: r.voidedCount, totalKobo: Number(r.totalKobo) });
  return out;
}

async function loadShifts(where: ReturnType<typeof and>, limit = 200): Promise<ShiftSummary[]> {
  const rows = await getCashierDb()
    .select({
      id: cashierShifts.id,
      cashierId: cashierShifts.cashierId,
      cashierName: user.name,
      openedAt: cashierShifts.openedAt,
      closedAt: cashierShifts.closedAt,
      status: cashierShifts.status,
      openingFloatKobo: cashierShifts.openingFloatKobo,
      varianceKobo: cashierShifts.varianceKobo,
      reportSentAt: cashierShifts.reportSentAt,
    })
    .from(cashierShifts)
    .innerJoin(user, eq(cashierShifts.cashierId, user.id))
    .where(where)
    .orderBy(desc(cashierShifts.openedAt))
    .limit(limit);
  const totals = await summariseShifts(rows.map((r) => r.id));
  const staleBefore = Date.now() - STALE_SHIFT_HOURS * 3_600_000;
  return rows.map((r) => ({
    ...r,
    openedAt: r.openedAt.toISOString(),
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    reportSentAt: r.reportSentAt ? r.reportSentAt.toISOString() : null,
    receiptCount: totals.get(r.id)?.receiptCount ?? 0,
    voidedCount: totals.get(r.id)?.voidedCount ?? 0,
    totalKobo: totals.get(r.id)?.totalKobo ?? 0,
    stale: r.status === "open" && r.openedAt.getTime() < staleBefore,
  }));
}

/** A cashier may only touch their own shift; a Super Admin may view any. */
async function assertShiftAccess(shiftId: string): Promise<ShiftSummary | null> {
  if (!/^[0-9a-f-]{36}$/i.test(shiftId)) return null;
  const { session, role } = await requireCashierArea();
  const [shift] = await loadShifts(and(eq(cashierShifts.id, shiftId)));
  if (!shift) return null;
  if (role === "cashier" && shift.cashierId !== session.user.id) return null;
  return shift;
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export async function getMyOpenShift(): Promise<ShiftSummary | null> {
  const { session } = await requireCashierArea();
  const [shift] = await loadShifts(and(eq(cashierShifts.cashierId, session.user.id), eq(cashierShifts.status, "open")));
  return shift ?? null;
}

/** Opens a shift, stamped by the server clock. A second Start while one is open is refused. */
export async function startShift(openingFloat: string): Promise<{ success: true; shift: ShiftSummary } | Fail> {
  const { session, role } = await requireCashierArea();
  if (role !== "cashier") return { success: false, error: "Only cashier accounts open shifts" };
  const floatKobo = parseNairaToKobo(openingFloat || "0");
  if (floatKobo === null || floatKobo > MAX_PRICE_KOBO) return { success: false, error: "Enter the cash in the drawer, e.g. 5000 (or 0)" };
  if (await openShiftOf(session.user.id)) return { success: false, error: "You already have an open shift. Close it before starting another." };

  try {
    await getCashierDb().transaction(async (tx) => {
      const [shift] = await tx
        .insert(cashierShifts)
        .values({ cashierId: session.user.id, openingFloatKobo: floatKobo })
        .returning({ id: cashierShifts.id });
      await logEvent({
        tx,
        category: "billing",
        action: "shift.opened",
        summary: `${session.user.name} opened a cashier shift with an opening float of ${formatKobo(floatKobo)}`,
        ...actor(session, role),
        targetType: "cashier_shift",
        targetId: shift!.id,
        metadata: { openingFloatKobo: floatKobo },
      });
    });
  } catch (err) {
    // The one-open-shift unique index caught a double tap.
    console.warn("startShift refused:", err);
    return { success: false, error: "You already have an open shift. Close it before starting another." };
  }
  const shift = await getMyOpenShift();
  return shift ? { success: true, shift } : { success: false, error: "Could not open a shift" };
}

/** Live figures for the close-shift screen (totals, voids, expected cash) before the drawer is counted. */
export async function getCloseSummary(): Promise<ShiftReportSnapshot | null> {
  const { session } = await requireCashierArea();
  const shift = await openShiftOf(session.user.id);
  return shift ? buildShiftReport(getCashierDb(), shift.id) : null;
}

/**
 * Closes the cashier's shift with the counted drawer. A non-zero variance
 * needs a note. The report snapshot is written in the same transaction and
 * never changes afterwards; the DB also refuses to reopen or edit the shift.
 */
export async function closeShift(input: { counted: string; note?: string }): Promise<{ success: true; shiftId: string } | Fail> {
  const { session, role } = await requireCashierArea();
  if (role !== "cashier") return { success: false, error: "Only the cashier can close their own shift" };
  const countedKobo = parseNairaToKobo(input.counted ?? "");
  if (countedKobo === null || countedKobo > MAX_PRICE_KOBO) return { success: false, error: "Type the amount of cash you counted in the drawer" };
  const note = input.note?.trim() || null;

  const shift = await openShiftOf(session.user.id);
  if (!shift) return { success: false, error: "You don't have an open shift" };

  try {
    await getCashierDb().transaction(async (tx) => {
      const closedAt = new Date();
      const snapshot = await buildShiftReport(tx, shift.id, { countedCashKobo: countedKobo, closingNote: note, closedAt });
      if (!snapshot) throw new Error("SHIFT_NOT_FOUND");
      const variance = snapshot.cash.varianceKobo ?? 0;
      if (variance !== 0 && !note) throw new Error("NOTE_REQUIRED");

      const closed = await tx
        .update(cashierShifts)
        .set({
          status: "closed",
          closedAt,
          expectedCashKobo: snapshot.cash.expectedCashKobo,
          countedCashKobo: countedKobo,
          varianceKobo: variance,
          closingNote: note,
        })
        .where(and(eq(cashierShifts.id, shift.id), eq(cashierShifts.status, "open")))
        .returning({ id: cashierShifts.id });
      if (closed.length === 0) throw new Error("ALREADY_CLOSED");

      await tx.insert(shiftReports).values({ shiftId: shift.id, snapshot });
      await logEvent({
        tx,
        category: "billing",
        action: "shift.closed",
        summary: `${session.user.name} closed their shift: ${snapshot.totals.issuedCount} receipt(s), ${formatKobo(snapshot.totals.issuedKobo)} taken, ${snapshot.totals.voidCount} void(s), drawer ${describeVariance(variance, formatKobo)}`,
        ...actor(session, role),
        targetType: "cashier_shift",
        targetId: shift.id,
        metadata: {
          receiptCount: snapshot.totals.issuedCount,
          totalKobo: snapshot.totals.issuedKobo,
          voidCount: snapshot.totals.voidCount,
          expectedCashKobo: snapshot.cash.expectedCashKobo,
          countedCashKobo: countedKobo,
          varianceKobo: variance,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOTE_REQUIRED") {
      return { success: false, error: "The drawer doesn't balance. Add a note explaining the difference before closing." };
    }
    if (err instanceof Error && err.message === "ALREADY_CLOSED") return { success: false, error: "This shift is already closed" };
    throw err;
  }
  return { success: true, shiftId: shift.id };
}

/** The cashier's own past shifts, newest first. */
export async function listMyShifts(): Promise<ShiftSummary[]> {
  const { session } = await requireCashierArea();
  return loadShifts(and(eq(cashierShifts.cashierId, session.user.id)), 60);
}

/** Super Admin: shifts opened on a date (Lagos time), plus any still open. */
export async function listShifts(date: string): Promise<ShiftSummary[]> {
  const { role } = await requireCashierArea();
  if (role !== "super_admin") return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  return loadShifts(
    or(
      sql`(${cashierShifts.openedAt} AT TIME ZONE 'Africa/Lagos')::date = ${date}::date`,
      eq(cashierShifts.status, "open"),
    ),
  );
}

/** Super Admin: shifts open longer than STALE_SHIFT_HOURS. */
export async function listStaleShifts(): Promise<ShiftSummary[]> {
  const { role } = await requireCashierArea();
  if (role !== "super_admin") return [];
  return loadShifts(
    and(eq(cashierShifts.status, "open"), lt(cashierShifts.openedAt, new Date(Date.now() - STALE_SHIFT_HOURS * 3_600_000))),
  );
}

/** A shift's report: the stored snapshot once closed, live figures while open. */
export async function getShiftReportView(shiftId: string): Promise<ShiftReportView | null> {
  const shift = await assertShiftAccess(shiftId);
  if (!shift) return null;
  const { session } = await requireCashierArea();
  const isOwner = shift.cashierId === session.user.id;

  if (shift.status === "closed") {
    const [stored] = await getCashierDb()
      .select({ snapshot: shiftReports.snapshot })
      .from(shiftReports)
      .where(eq(shiftReports.shiftId, shiftId));
    if (stored) {
      return {
        snapshot: stored.snapshot as ShiftReportSnapshot,
        stored: true,
        reportSentAt: shift.reportSentAt,
        canSend: isOwner && !shift.reportSentAt,
      };
    }
  }
  const live = await buildShiftReport(getCashierDb(), shiftId);
  return live ? { snapshot: live, stored: false, reportSentAt: null, canSend: false } : null;
}

/**
 * "Send to management": an in-app message with the report attached to every
 * Super Admin, plus an email. Sent once; the stored snapshot is what's sent.
 */
export async function sendShiftReport(shiftId: string): Promise<{ success: true; recipients: number; emailed: number; emailConfigured: boolean } | Fail> {
  const { session, role } = await requireCashierArea();
  const shift = await assertShiftAccess(shiftId);
  if (!shift || shift.cashierId !== session.user.id) return { success: false, error: "Report not found" };
  if (shift.status !== "closed") return { success: false, error: "Close the shift before sending its report" };
  if (shift.reportSentAt) return { success: false, error: "This report was already sent to management" };

  const [report] = await getCashierDb()
    .select({ id: shiftReports.id, snapshot: shiftReports.snapshot })
    .from(shiftReports)
    .where(eq(shiftReports.shiftId, shiftId));
  if (!report) return { success: false, error: "Report not found" };
  const snap = report.snapshot as ShiftReportSnapshot;

  const admins = await mainDb
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(and(eq(user.role, "super_admin"), isNull(user.deletedAt), eq(user.banned, false)));
  if (admins.length === 0) return { success: false, error: "No Super Admin accounts to send to" };

  const variance = snap.cash.varianceKobo ?? 0;
  const opened = new Date(snap.shift.openedAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
  const headline = `Shift report: ${snap.shift.cashierName}, ${opened}. ${snap.totals.issuedCount} receipt(s), ${formatKobo(snap.totals.issuedKobo)} taken, ${snap.totals.voidCount} void(s), drawer ${describeVariance(variance, formatKobo)}.`;

  for (const admin of admins) {
    const conversationId = await getOrCreateDmConversation(session.user.id, admin.id);
    await insertMessageWithAttachment({
      conversationId,
      senderId: session.user.id,
      body: headline,
      attachment: { kind: "shift_report", shiftReportId: report.id },
      activityLog: {
        category: "messages",
        action: "message.sent",
        summary: `${session.user.name} sent a shift report to a Super Admin`,
        actorRoleAtTime: role,
        actorLabel: session.user.name,
        metadata: { shiftId },
      },
    });
  }

  // The email provider fakes success when no API key is set, so check first
  // and log honestly rather than claiming emails went out.
  const emailConfigured = Boolean(process.env.RESEND_API_KEY);
  let emailed = 0;
  if (emailConfigured) {
    const base = process.env.BETTER_AUTH_URL || "https://gardencityhospital.vercel.app";
    const link = `${base}/cashier/reports/${shiftId}`;
    const text = `${headline}\n\nOpen the full report: ${link}`;
    for (const admin of admins) {
      if (!admin.email) continue;
      const res = await emailProvider.sendEmail(admin.email, `Cashier shift report: ${snap.shift.cashierName}`, text);
      if (res.success) emailed++;
    }
  }

  await getCashierDb().transaction(async (tx) => {
    await tx.update(cashierShifts).set({ reportSentAt: new Date() }).where(and(eq(cashierShifts.id, shiftId), isNull(cashierShifts.reportSentAt)));
    await logEvent({
      tx,
      category: "billing",
      action: "shift_report.sent",
      summary: `${session.user.name} sent their shift report to ${admins.length} Super Admin(s)${emailConfigured ? `, ${emailed} emailed` : " (email not configured)"}`,
      ...actor(session, role),
      targetType: "cashier_shift",
      targetId: shiftId,
      metadata: { recipients: admins.length, emailed, emailConfigured, shiftReportId: report.id },
    });
  });

  return { success: true, recipients: admins.length, emailed, emailConfigured };
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

export async function listShiftReceipts(shiftId: string): Promise<ReceiptSummary[]> {
  const shift = await assertShiftAccess(shiftId);
  if (!shift) return [];
  const { session, role } = await requireCashierArea();
  const rows = await getCashierDb()
    .select({
      id: receipts.id,
      receiptNo: receipts.receiptNo,
      payerName: receipts.payerName,
      totalKobo: receipts.totalKobo,
      paymentMode: receipts.paymentMode,
      issuedAt: receipts.issuedAt,
      issuedBy: receipts.issuedBy,
      issuedByName: user.name,
      status: receipts.status,
      voidReason: receipts.voidReason,
      printCount: sql<number>`(select count(*)::int from ${receiptPrints} where ${receiptPrints.receiptId} = ${receipts.id})`,
    })
    .from(receipts)
    .innerJoin(user, eq(receipts.issuedBy, user.id))
    .where(eq(receipts.shiftId, shiftId))
    .orderBy(desc(receipts.issuedAt));
  return rows.map(({ issuedBy, ...r }) => ({
    ...r,
    receiptNo: formatReceiptNo(r.receiptNo),
    issuedAt: r.issuedAt.toISOString(),
    canVoid:
      r.status === "issued" &&
      (role === "super_admin" ||
        (issuedBy === session.user.id && shift.status === "open" && isWithinCashierVoidWindow(r.issuedAt))),
  }));
}

/**
 * Records a print (call right before opening the PDF). Returns the print id;
 * the PDF route uses it to label the 2nd and later copies DUPLICATE without
 * the PDF GET itself having side effects (PDF viewers re-request freely).
 */
export async function recordReceiptPrint(receiptId: string): Promise<{ success: true; printId: string; copy: number } | Fail> {
  const { session, role } = await requireCashierArea();
  const db = getCashierDb();
  const [r] = await db
    .select({ receiptNo: receipts.receiptNo, issuedBy: receipts.issuedBy })
    .from(receipts)
    .where(eq(receipts.id, receiptId));
  if (!r || (role === "cashier" && r.issuedBy !== session.user.id)) return { success: false, error: "Receipt not found" };

  return db.transaction(async (tx) => {
    const [print] = await tx.insert(receiptPrints).values({ receiptId, printedBy: session.user.id }).returning({ id: receiptPrints.id });
    const [{ copy }] = await tx
      .select({ copy: sql<number>`count(*)::int` })
      .from(receiptPrints)
      .where(eq(receiptPrints.receiptId, receiptId));
    await logEvent({
      tx,
      category: "billing",
      action: copy > 1 ? "receipt.reprinted" : "receipt.printed",
      summary: `${session.user.name} ${copy > 1 ? `re-printed (copy ${copy})` : "printed"} receipt ${formatReceiptNo(r.receiptNo)}`,
      ...actor(session, role),
      targetType: "receipt",
      targetId: receiptId,
      metadata: { copy },
    });
    return { success: true as const, printId: print!.id, copy: copy! };
  });
}

// ---------------------------------------------------------------------------
// Patients (limited columns only) & catalogue
// ---------------------------------------------------------------------------

const CASHIER_PATIENT_COLUMNS = {
  id: patients.id,
  surname: patients.surname,
  firstNames: patients.firstNames,
  hospitalNumber: patients.hospitalNumber,
  age: patients.age,
  sex: patients.sex,
  phone: patients.phone,
};

function toCashierPatient(p: { id: string; surname: string; firstNames: string; hospitalNumber: string; age: string | null; sex: string | null; phone: string | null }): CashierPatient {
  return { ...p, age: p.age ?? "", sex: p.sex ?? "", phone: p.phone ?? "" };
}

export async function searchPatientsForCashier(query: string): Promise<CashierPatient[]> {
  await requireCashierArea();
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  if (words.length === 0) return [];
  const rows = await getCashierDb()
    .select(CASHIER_PATIENT_COLUMNS)
    .from(patients)
    .where(
      and(
        ...words.map((w) =>
          or(ilike(patients.surname, `%${w}%`), ilike(patients.firstNames, `%${w}%`), ilike(patients.hospitalNumber, `%${w}%`)),
        ),
      ),
    )
    .orderBy(asc(patients.surname))
    .limit(10);
  return rows.map(toCashierPatient);
}

/** The patient's own payment history (all their receipts), shown when a patient is picked. */
export async function getPatientReceiptHistory(patientId: string): Promise<ReceiptSummary[]> {
  await requireCashierArea();
  const rows = await getCashierDb()
    .select({
      id: receipts.id,
      receiptNo: receipts.receiptNo,
      payerName: receipts.payerName,
      totalKobo: receipts.totalKobo,
      paymentMode: receipts.paymentMode,
      issuedAt: receipts.issuedAt,
      issuedByName: user.name,
      status: receipts.status,
      voidReason: receipts.voidReason,
    })
    .from(receipts)
    .innerJoin(user, eq(receipts.issuedBy, user.id))
    .where(eq(receipts.patientId, patientId))
    .orderBy(desc(receipts.issuedAt))
    .limit(20);
  return rows.map((r) => ({ ...r, receiptNo: formatReceiptNo(r.receiptNo), issuedAt: r.issuedAt.toISOString(), printCount: 0, canVoid: false }));
}

export async function getSaleCatalogue(): Promise<SaleCategory[]> {
  await requireCashierArea();
  const db = getCashierDb();
  const [cats, rows] = await Promise.all([
    db
      .select({ id: serviceCategories.id, name: serviceCategories.name })
      .from(serviceCategories)
      .where(eq(serviceCategories.active, true))
      .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name)),
    db
      .select({
        id: services.id,
        categoryId: services.categoryId,
        name: services.name,
        priceKobo: services.priceKobo,
        folderColour: services.folderColour,
        allowCustomAmount: services.allowCustomAmount,
      })
      .from(services)
      .where(eq(services.active, true))
      .orderBy(asc(services.sortOrder), asc(services.name)),
  ]);
  return cats
    .map((c) => ({
      id: c.id,
      name: c.name,
      services: rows
        .filter((s) => s.categoryId === c.id)
        .map((s) => ({
          id: s.id,
          name: s.name,
          priceKobo: s.priceKobo,
          folderColour: s.folderColour,
          allowCustomAmount: s.allowCustomAmount,
        })),
    }))
    .filter((c) => c.services.length > 0);
}
