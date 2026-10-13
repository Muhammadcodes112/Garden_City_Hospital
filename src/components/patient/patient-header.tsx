"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Calendar, LayoutDashboard, PlusCircle, LogOut, User, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function PatientHeader({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  const navItems = [
    { href: "/patient", label: "Dashboard", icon: LayoutDashboard },
    { href: "/patient/appointments", label: "My Appointments", icon: Calendar },
    { href: "/book", label: "Book Appointment", icon: PlusCircle },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      {/* Top brand gradient line */}
      <div
        className="h-1 w-full bg-gradient-to-r from-brand-black via-brand-green to-brand-orange"
        aria-hidden
      />

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/patient" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-black to-brand-green p-1.5 shadow-xs">
            <Image
              src="/brand/logo-mark-dark.svg"
              alt="Garden City Specialist Hospital"
              width={28}
              height={28}
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <span className="font-black text-sm tracking-tight text-foreground block leading-tight">
              Garden City Hospital
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-green">
              Patient Portal
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                  active
                    ? "bg-brand-green/10 text-brand-green"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Account / Sign Out */}
        <div className="hidden md:flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-bold text-foreground truncate max-w-[150px]">
              {userName}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">
              {userEmail}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </Button>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            className="h-9 w-9 text-foreground"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-border bg-card px-4 py-4 md:hidden space-y-2 animate-in fade-in">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold ${
                  active
                    ? "bg-brand-green/10 text-brand-green"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-3 border-t border-border/80 flex items-center justify-between">
            <div className="text-xs font-bold text-foreground">{userName}</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-xs text-rose-600 font-bold gap-1"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
