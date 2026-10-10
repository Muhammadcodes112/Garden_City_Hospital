import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { db } from "@/db";
import { inventoryItems } from "@/db/schema";
import { seedInventoryIfNeeded } from "@/lib/inventory";
import { desc, like, or, and, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  await requireStaff();

  try {
    // Seed default items if catalog is empty
    await seedInventoryIfNeeded();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category") || "";

    const conditions = [];
    if (q) {
      conditions.push(
        or(
          like(inventoryItems.name, `%${q}%`),
          like(inventoryItems.strength, `%${q}%`),
          like(inventoryItems.category, `%${q}%`)
        )
      );
    }

    if (category && category !== "all") {
      conditions.push(eq(inventoryItems.category, category));
    }

    const items = await db
      .select()
      .from(inventoryItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(inventoryItems.updatedAt));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Failed to fetch inventory:", err);
    return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await requireStaff();

  try {
    const body = await req.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Item name is required" }, { status: 400 });
    }

    const [created] = await db
      .insert(inventoryItems)
      .values({
        name: body.name.trim(),
        category: body.category || "Medication",
        unit: body.unit || "Tablet",
        strength: body.strength || "",
        dosageForm: body.dosageForm || "Oral",
        unitPrice: Number(body.unitPrice) || 0,
        defaultFrequency: body.defaultFrequency || "",
        defaultDuration: body.defaultDuration || "",
        stockQuantity: Number(body.stockQuantity) || 100,
        isAvailable: body.isAvailable !== false,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("Failed to create inventory item:", err);
    return NextResponse.json({ error: "Failed to create inventory item" }, { status: 500 });
  }
}
