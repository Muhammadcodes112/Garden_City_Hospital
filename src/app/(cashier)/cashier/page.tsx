import type { Metadata } from "next";
import { requireCashierArea } from "@/lib/authz";
import { getMyOpenShift, getSaleCatalogue, listShiftReceipts, listShifts } from "@/lib/actions/cashier";
import { CashierDesk } from "@/components/cashier/cashier-desk";
import { CashierOverview } from "@/components/cashier/cashier-overview";

export const metadata: Metadata = {
  title: "Cashier Desk | Garden City Specialist Hospital",
};

export const dynamic = "force-dynamic";

function lagosToday(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

export default async function CashierPage() {
  const { session, role } = await requireCashierArea();

  if (role === "super_admin") {
    const today = lagosToday();
    return <CashierOverview initialDate={today} initialShifts={await listShifts(today)} />;
  }

  const [shift, catalogue] = await Promise.all([getMyOpenShift(), getSaleCatalogue()]);
  const receipts = shift ? await listShiftReceipts(shift.id) : [];
  return (
    <CashierDesk
      cashierName={session.user.name ?? session.user.email}
      initialShift={shift}
      initialReceipts={receipts}
      catalogue={catalogue}
    />
  );
}
