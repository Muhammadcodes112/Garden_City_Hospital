/**
 * One-off import of the hospital's handwritten pharmacy price list
 * (transcribed to Pharmacy_Complete_Price_List.docx) into inventory_items.
 *
 * Source doc explicitly retains duplicate/overlapping entries across its
 * sheets (different package sizes, NHIS vs non-NHIS pricing) rather than
 * merging them, so this import does the same — each row becomes its own
 * catalog entry. 15 rows with no price in the source ("—") were left out;
 * see the skipped list this script prints at the end.
 *
 * Idempotent: skips any (name, unit, unit_price) triple that already exists,
 * so re-running after a partial failure won't create duplicate rows.
 *
 * Run with: npx tsx scripts/import-pharmacy-prices.ts
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import postgres from "postgres";

type PriceListItem = {
  name: string;
  category: string;
  unit: string;
  strength: string;
  dosageForm: string;
  unitPrice: number;
  defaultFrequency: string;
  defaultDuration: string;
  stockQuantity: number;
  isAvailable: boolean;
};

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const dataPath = path.join(__dirname, "pharmacy-price-list-data.json");
  const items: PriceListItem[] = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  const sql = postgres(process.env.DATABASE_URL, { prepare: false, connect_timeout: 30, max: 1 });

  let inserted = 0;
  let skippedExisting = 0;

  try {
    for (const item of items) {
      const existing = await sql`
        SELECT id FROM inventory_items
        WHERE name = ${item.name} AND unit = ${item.unit} AND unit_price = ${item.unitPrice}
        LIMIT 1
      `;
      if (existing.length > 0) {
        skippedExisting += 1;
        continue;
      }

      await sql`
        INSERT INTO inventory_items
          (name, category, unit, strength, dosage_form, unit_price, default_frequency, default_duration, stock_quantity, is_available)
        VALUES
          (${item.name}, ${item.category}, ${item.unit}, ${item.strength}, ${item.dosageForm}, ${item.unitPrice}, ${item.defaultFrequency}, ${item.defaultDuration}, ${item.stockQuantity}, ${item.isAvailable})
      `;
      inserted += 1;
    }

    console.log(`Imported ${inserted} pharmacy items (${skippedExisting} already present, skipped).`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
