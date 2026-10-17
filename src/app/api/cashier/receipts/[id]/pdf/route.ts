import { NextResponse } from "next/server";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getCashierDb } from "@/db/cashier";
import { receiptLines, receiptPrints, receipts, user } from "@/db/schema";
import { requireCashierArea } from "@/lib/authz";
import { renderPdf } from "@/lib/pdf";
import { receiptPdfFilename, receiptPdfHtml } from "@/lib/pdf-templates/receipt";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Renders a receipt. Side-effect free: the Print button first calls
 * recordReceiptPrint() and passes the returned print id as ?print=, which
 * decides the copy number (2nd and later copies print "DUPLICATE").
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, role } = await requireCashierArea();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const printId = url.searchParams.get("print");
  const wantsHtml = url.searchParams.get("html") === "1";

  const db = getCashierDb();
  const issuer = alias(user, "issuer");
  const voider = alias(user, "voider");
  const [r] = await db
    .select({
      receiptNo: receipts.receiptNo,
      issuedAt: receipts.issuedAt,
      payerName: receipts.payerName,
      totalKobo: receipts.totalKobo,
      amountInWords: receipts.amountInWords,
      paymentMode: receipts.paymentMode,
      tellerOrTransferRef: receipts.tellerOrTransferRef,
      chequeNo: receipts.chequeNo,
      issuedBy: receipts.issuedBy,
      issuedByName: issuer.name,
      status: receipts.status,
      voidReason: receipts.voidReason,
      voidedAt: receipts.voidedAt,
      voidedByName: voider.name,
    })
    .from(receipts)
    .innerJoin(issuer, eq(receipts.issuedBy, issuer.id))
    .leftJoin(voider, eq(receipts.voidedBy, voider.id))
    .where(eq(receipts.id, id));

  // A cashier sees only their own receipts; same 404 either way so ids can't be probed.
  if (!r || (role === "cashier" && r.issuedBy !== session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const lines = await db
    .select({ description: receiptLines.description, qty: receiptLines.qty })
    .from(receiptLines)
    .where(eq(receiptLines.receiptId, id))
    .orderBy(asc(receiptLines.id));

  let copy = 1;
  const [thisPrint] = printId && /^[0-9a-f-]{36}$/i.test(printId)
    ? await db
        .select({ printedAt: receiptPrints.printedAt })
        .from(receiptPrints)
        .where(and(eq(receiptPrints.id, printId), eq(receiptPrints.receiptId, id)))
    : [];
  if (thisPrint) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(receiptPrints)
      .where(and(eq(receiptPrints.receiptId, id), lte(receiptPrints.printedAt, thisPrint.printedAt)));
    copy = Math.max(1, n);
  } else {
    // Viewed without a recorded print: label by how many copies already exist.
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(receiptPrints)
      .where(eq(receiptPrints.receiptId, id));
    copy = Math.max(1, n);
  }

  const html = receiptPdfHtml({
    receiptNo: r.receiptNo,
    issuedAt: r.issuedAt,
    payerName: r.payerName,
    totalKobo: r.totalKobo,
    amountInWords: r.amountInWords,
    paymentMode: r.paymentMode,
    tellerOrTransferRef: r.tellerOrTransferRef,
    chequeNo: r.chequeNo,
    issuedByName: r.issuedByName,
    lines,
    status: r.status,
    voidReason: r.voidReason,
    voidedAt: r.voidedAt,
    voidedByName: r.voidedByName,
    copy,
  });
  const filename = receiptPdfFilename(r.receiptNo);

  if (wantsHtml) {
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }

  try {
    const pdf = await renderPdf(html);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Failed to render receipt PDF:", err);
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
}
