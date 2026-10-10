import { requireStaff } from "@/lib/authz";
import { InventoryView } from "@/components/inventory/inventory-view";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  await requireStaff();

  return <InventoryView />;
}
