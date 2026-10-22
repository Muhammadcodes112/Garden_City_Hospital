import Link from "next/link";
import { requireCashierArea } from "@/lib/authz";
import { listMyShifts } from "@/lib/actions/cashier";
import { formatKobo } from "@/lib/money";
import { describeVariance } from "@/lib/cashier-policy";
import { isCashierDbConfigured } from "@/db/cashier";

export const dynamic = "force-dynamic";

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
}

/** The cashier's own past shifts. (Super Admins use the shifts overview on /cashier.) */
export default async function MyShiftReportsPage() {
  const { role } = await requireCashierArea();
  if (!isCashierDbConfigured()) return null; // the layout shows the setup notice
  const shifts = role === "cashier" ? await listMyShifts() : [];
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">My shift reports</h1>
        <Link href="/cashier" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← Cashier desk
        </Link>
      </div>
      {shifts.length === 0 ? (
        <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground">No shifts yet.</p>
      ) : (
        <ul className="space-y-2">
          {shifts.map((s) => (
            <li key={s.id}>
              <Link href={`/cashier/reports/${s.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted">
                <span>
                  <span className="block text-sm font-semibold text-foreground">{dateTime(s.openedAt)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.status === "open" ? "Open now" : `${s.receiptCount} receipt(s) · ${s.voidedCount} void(s) · drawer ${describeVariance(s.varianceKobo ?? 0, formatKobo)}`}
                    {s.reportSentAt ? " · sent to management" : ""}
                  </span>
                </span>
                <span className="font-mono text-sm font-black text-foreground">{formatKobo(s.totalKobo)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
