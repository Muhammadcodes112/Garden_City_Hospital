import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { db } from "@/db";
import { inventoryItems } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireStaff();

  const { id } = await params;

  try {
    const body = await req.json();

    const [updated] = await db
      .update(inventoryItems)
      .set({
        name: body.name,
        category: body.category,
        unit: body.unit,
        strength: body.strength,
        dosageForm: body.dosageForm,
        unitPrice: Number(body.unitPrice),
        defaultFrequency: body.defaultFrequency,
        defaultDuration: body.defaultDuration,
        stockQuantity: Number(body.stockQuantity),
        isAvailable: body.isAvailable,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Failed to update inventory item:", err);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireStaff();

  const { id } = await params;

  try {
    await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete inventory item:", err);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
