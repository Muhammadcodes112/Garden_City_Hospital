import { NextRequest, NextResponse } from "next/server";
import { requireStaff, requireSuperAdmin } from "@/lib/authz";
import { db } from "@/db";
import { patients, formRecords, patientPayments, patientVitals, receipts, user, cashierShifts } from "@/db/schema";
import { and, eq, desc, isNull, sql } from "drizzle-orm";
import { NIGERIAN_PHONE_MESSAGE, isValidNigerianPhone } from "@/lib/validators/phone";
import { deletePatientsCascade } from "@/lib/patient-deletion";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireStaff();

  const { id } = await params;

  try {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Fetch patient's medical form records (Lab, Prescription, Medical Report)
    const records = await db
      .select({
        id: formRecords.id,
        type: formRecords.type,
        status: formRecords.status,
        updatedAt: formRecords.updatedAt,
        createdAt: formRecords.createdAt,
        data: formRecords.data,
      })
      .from(formRecords)
      .where(and(eq(formRecords.patientId, id), isNull(formRecords.deletedAt)))
      .orderBy(desc(formRecords.updatedAt));

    // Payment history is the cashier's receipts. patient_payments holds the
    // pre-receipt "Confirm Payment" clearances, kept read-only as history.
    const patientReceipts = await db
      .select({
        id: receipts.id,
        receiptNo: receipts.receiptNo,
        issuedAt: receipts.issuedAt,
        payerName: receipts.payerName,
        totalKobo: receipts.totalKobo,
        paymentMode: receipts.paymentMode,
        status: receipts.status,
        voidReason: receipts.voidReason,
        issuedByName: sql<string>`coalesce(${cashierShifts.cashierName}, ${user.name})`,
      })
      .from(receipts)
      .innerJoin(user, eq(receipts.issuedBy, user.id))
      .innerJoin(cashierShifts, eq(receipts.shiftId, cashierShifts.id))
      .where(eq(receipts.patientId, id))
      .orderBy(desc(receipts.issuedAt));

    const payments = await db
      .select()
      .from(patientPayments)
      .where(eq(patientPayments.patientId, id))
      .orderBy(desc(patientPayments.confirmedAt));

    const vitals = await db
      .select()
      .from(patientVitals)
      .where(eq(patientVitals.patientId, id))
      .orderBy(desc(patientVitals.recordedAt));

    return NextResponse.json({
      patient,
      records,
      receipts: patientReceipts,
      payments,
      vitals,
    });
  } catch (err) {
    console.error("Failed to fetch patient detail:", err);
    return NextResponse.json({ error: "Failed to fetch patient" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireStaff();

  const { id } = await params;

  try {
    const body = await req.json();

    if (body.phone && !isValidNigerianPhone(body.phone)) {
      return NextResponse.json({ error: `Phone: ${NIGERIAN_PHONE_MESSAGE}` }, { status: 400 });
    }
    if (body.nextOfKinPhone && !isValidNigerianPhone(body.nextOfKinPhone)) {
      return NextResponse.json({ error: `Next of Kin Phone: ${NIGERIAN_PHONE_MESSAGE}` }, { status: 400 });
    }

    const [updated] = await db
      .update(patients)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Failed to update patient:", err);
    return NextResponse.json({ error: "Failed to update patient" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireSuperAdmin();

  const { id } = await params;

  try {
    await db.transaction((tx) => deletePatientsCascade(tx, [id]));
    return NextResponse.json({ success: true, message: "Patient file deleted successfully" });
  } catch (err) {
    console.error("Failed to delete patient:", err);
    return NextResponse.json({ error: "Failed to delete patient" }, { status: 500 });
  }
}
