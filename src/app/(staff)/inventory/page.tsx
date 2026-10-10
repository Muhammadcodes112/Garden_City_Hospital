import { requireAdmin } from "@/lib/session";
import { InventoryView } from "@/components/inventory/inventory-view";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  await requireAdmin();

  return <InventoryView />;
}
