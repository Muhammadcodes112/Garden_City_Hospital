import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { patients, formRecords } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      .where(eq(formRecords.patientId, id))
      .orderBy(desc(formRecords.updatedAt));

    return NextResponse.json({
      patient,
      records,
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
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();

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
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSuperAdmin = (session.user as { role?: string }).role === "super_admin";
  if (!isSuperAdmin) {
    return NextResponse.json({ error: "Only Super Admin can delete patients" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await db.delete(patients).where(eq(patients.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete patient:", err);
    return NextResponse.json({ error: "Failed to delete patient" }, { status: 500 });
  }
}
