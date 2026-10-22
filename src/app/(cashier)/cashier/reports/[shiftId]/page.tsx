import Link from "next/link";
import { notFound } from "next/navigation";
import { getShiftReportView } from "@/lib/actions/cashier";
import { ShiftReportDocument } from "@/components/cashier/shift-report";
import { isCashierDbConfigured } from "@/db/cashier";

export const dynamic = "force-dynamic";

/** A cashier sees their own shifts' reports; a Super Admin sees any (e.g. from a "Send to management" message). */
export default async function ShiftReportPage({ params }: { params: Promise<{ shiftId: string }> }) {
  const { shiftId } = await params;
  if (!isCashierDbConfigured()) return null; // the layout shows the setup notice
  const view = await getShiftReportView(shiftId);
  if (!view) notFound();
  return (
    <div className="space-y-3">
      <div className="mx-auto max-w-4xl print:hidden">
        <Link href="/cashier/reports" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← All shift reports
        </Link>
      </div>
      <ShiftReportDocument view={view} />
    </div>
  );
}
