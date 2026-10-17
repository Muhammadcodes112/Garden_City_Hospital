import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/authz";
import { getPriceList } from "@/lib/actions/price-list";
import { PriceListView } from "@/components/admin/price-list-view";

export const metadata: Metadata = {
  title: "Price List | Garden City Specialist Hospital",
  description: "Service catalogue and prices, managed by the hospital.",
};

export const dynamic = "force-dynamic";

export default async function PriceListPage() {
  await requireSuperAdmin();
  const categories = await getPriceList();
  return <PriceListView categories={categories} />;
}
