import { db } from "@/db";
import { inventoryItems } from "@/db/schema";
import { eq, desc, like, or } from "drizzle-orm";

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  unitPrice: number; // in NGN
  defaultFrequency?: string | null;
  defaultDuration?: string | null;
  stockQuantity?: number | null;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// Preset default Nigerian drug & hospital item catalog (seeded automatically if database is empty)
export const DEFAULT_NIGERIAN_INVENTORY = [
  {
    name: "Paracetamol 500mg (Panadol)",
    category: "Medication",
    unit: "Tablet",
    strength: "500mg",
    dosageForm: "Oral",
    unitPrice: 200, // ₦200 per pack/strip
    defaultFrequency: "TDS (3x daily)",
    defaultDuration: "5 days",
    stockQuantity: 500,
  },
  {
    name: "Amoxicillin 500mg (Amoxil)",
    category: "Medication",
    unit: "Capsule",
    strength: "500mg",
    dosageForm: "Oral",
    unitPrice: 1500, // ₦1,500
    defaultFrequency: "TDS (3x daily)",
    defaultDuration: "7 days",
    stockQuantity: 200,
  },
  {
    name: "Artemether + Lumefantrine 80/480mg (Coartem / ACT)",
    category: "Medication",
    unit: "Pack",
    strength: "80/480mg",
    dosageForm: "Oral",
    unitPrice: 2500, // ₦2,500
    defaultFrequency: "BD (2x daily)",
    defaultDuration: "3 days",
    stockQuantity: 150,
  },
  {
    name: "Ciprofloxacin 500mg (Ciprotab)",
    category: "Medication",
    unit: "Tablet",
    strength: "500mg",
    dosageForm: "Oral",
    unitPrice: 2000, // ₦2,000
    defaultFrequency: "BD (2x daily)",
    defaultDuration: "7 days",
    stockQuantity: 120,
  },
  {
    name: "Metronidazole 400mg (Flagyl)",
    category: "Medication",
    unit: "Tablet",
    strength: "400mg",
    dosageForm: "Oral",
    unitPrice: 800, // ₦800
    defaultFrequency: "TDS (3x daily)",
    defaultDuration: "5 days",
    stockQuantity: 300,
  },
  {
    name: "Ibuprofen 400mg",
    category: "Medication",
    unit: "Tablet",
    strength: "400mg",
    dosageForm: "Oral",
    unitPrice: 500, // ₦500
    defaultFrequency: "TDS (3x daily)",
    defaultDuration: "5 days",
    stockQuantity: 250,
  },
  {
    name: "Augmentin Syrup 228mg/5ml",
    category: "Medication",
    unit: "Bottle",
    strength: "228mg/5ml",
    dosageForm: "Oral Syrup",
    unitPrice: 4500, // ₦4,500
    defaultFrequency: "BD (2x daily)",
    defaultDuration: "7 days",
    stockQuantity: 80,
  },
  {
    name: "Omeprazole 20mg Capsules",
    category: "Medication",
    unit: "Capsule",
    strength: "20mg",
    dosageForm: "Oral",
    unitPrice: 1200, // ₦1,200
    defaultFrequency: "OD (1x daily)",
    defaultDuration: "14 days",
    stockQuantity: 100,
  },
  {
    name: "Folic Acid 5mg Tablets",
    category: "Medication",
    unit: "Tablet",
    strength: "5mg",
    dosageForm: "Oral",
    unitPrice: 300, // ₦300
    defaultFrequency: "OD (1x daily)",
    defaultDuration: "30 days",
    stockQuantity: 400,
  },
  {
    name: "Vitamin C 100mg Ascorbic Acid",
    category: "Medication",
    unit: "Bottle",
    strength: "100mg",
    dosageForm: "Oral",
    unitPrice: 400, // ₦400
    defaultFrequency: "BD (2x daily)",
    defaultDuration: "14 days",
    stockQuantity: 350,
  },
  {
    name: "IV Normal Saline 500ml",
    category: "Consumable",
    unit: "Bag",
    strength: "0.9% NaCl",
    dosageForm: "IV Infusion",
    unitPrice: 1800, // ₦1,800
    defaultFrequency: "STAT / Infusion",
    defaultDuration: "1 day",
    stockQuantity: 90,
  },
  {
    name: "IV Dextrose Saline 500ml",
    category: "Consumable",
    unit: "Bag",
    strength: "5% Dextrose",
    dosageForm: "IV Infusion",
    unitPrice: 2000, // ₦2,000
    defaultFrequency: "STAT / Infusion",
    defaultDuration: "1 day",
    stockQuantity: 85,
  },
  {
    name: "Disposable Syringe & Needle 5ml",
    category: "Consumable",
    unit: "Piece",
    strength: "5ml",
    dosageForm: "Injection Device",
    unitPrice: 150, // ₦150
    defaultFrequency: "STAT",
    defaultDuration: "1 day",
    stockQuantity: 1000,
  },
  {
    name: "Surgical Sterile Gloves (Pair)",
    category: "Consumable",
    unit: "Pair",
    strength: "Medium / Large",
    dosageForm: "Protection",
    unitPrice: 500, // ₦500
    defaultFrequency: "PRN",
    defaultDuration: "1 day",
    stockQuantity: 600,
  },
];

/** Ensures the database has inventory items seeded. */
export async function seedInventoryIfNeeded() {
  try {
    const existing = await db.select().from(inventoryItems).limit(1);
    if (existing.length === 0) {
      await db.insert(inventoryItems).values(DEFAULT_NIGERIAN_INVENTORY);
    }
  } catch (err) {
    console.error("Error seeding inventory:", err);
  }
}
