import Image from "next/image";
import Link from "next/link";
import { requireCashierArea } from "@/lib/authz";
import { UserMenu } from "@/components/layout/user-menu";
import { HOSPITAL_NAME } from "@/lib/brand";

/**
 * The cashier area deliberately does NOT use the staff AppShell: no clinical
 * navigation, records search or messaging. A Super Admin visiting gets a link
 * back to the main dashboard.
 */
export default async function CashierLayout({ children }: { children: React.ReactNode }) {
  const { session, role } = await requireCashierArea();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-brand-black text-white">
        <div className="h-1 w-full bg-gradient-to-r from-brand-black via-brand-red to-brand-orange" aria-hidden />
        <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/brand/logo-mark-dark.svg" alt={HOSPITAL_NAME} width={36} height={36} className="shrink-0 rounded-sm bg-white/10 p-0.5" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">Cashier Desk</p>
              <p className="truncate text-[11px] text-white/70 leading-tight">{HOSPITAL_NAME}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {role === "super_admin" ? (
              <Link href="/dashboard" className="text-xs font-semibold text-white/80 hover:text-white underline-offset-2 hover:underline">
                Back to dashboard
              </Link>
            ) : null}
            <UserMenu
              userName={session.user.name ?? session.user.email}
              userEmail={session.user.email}
              showSignature={role !== "cashier"}
            />
          </div>
        </div>
      </header>
      <main className="p-3 sm:p-4">{children}</main>
    </div>
  );
}
