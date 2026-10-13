"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Calendar, User, Menu, X, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HOSPITAL_NAME } from "@/lib/brand";

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
      {/* Hospital Accent Top Stripe */}
      <div
        className="h-1 w-full bg-gradient-to-r from-brand-black via-brand-green to-brand-orange"
        aria-hidden
      />

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <Link href="/book" className="flex items-center gap-3 group">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-black via-brand-black to-brand-green shadow-xs p-1.5 transition-transform duration-200 group-hover:scale-105">
            <Image
              src="/brand/logo-mark-dark.svg"
              alt="Garden City Specialist Hospital"
              width={32}
              height={32}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-sm sm:text-base tracking-tight text-foreground leading-tight">
              Garden City Specialist Hospital
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground hidden xs:inline">
              Kaduna · Patient Appointments
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/book"
            className="flex items-center gap-1.5 text-xs font-bold text-brand-green border-b-2 border-brand-green py-5"
          >
            <Calendar className="h-4 w-4" />
            <span>Book Appointment</span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Phone className="h-3.5 w-3.5 text-brand-green" />
            <span>Emergency: +234 800 427 3362</span>
          </div>
        </nav>

        {/* Desktop Auth Links */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="text-xs font-bold">
            <Link href="/sign-in" className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Staff Login</span>
            </Link>
          </Button>

          <Button
            size="sm"
            asChild
            className="bg-brand-green hover:bg-brand-green/90 text-white text-xs font-bold rounded-lg shadow-xs"
          >
            <Link href="/patient" className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              <span>Patient Portal</span>
            </Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
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
        <div className="border-t border-border bg-card px-4 py-4 md:hidden space-y-3 animate-in fade-in slide-in-from-top-2">
          <Link
            href="/book"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 rounded-lg bg-brand-green/10 px-3 py-2 text-xs font-bold text-brand-green"
          >
            <Calendar className="h-4 w-4" />
            <span>Book Appointment</span>
          </Link>

          <Link
            href="/patient"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
          >
            <User className="h-4 w-4 text-brand-green" />
            <span>Patient Portal</span>
          </Link>

          <Link
            href="/sign-in"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Staff / Admin Sign In</span>
          </Link>

          <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-brand-green" />
            <span>24/7 Helpline: +234 800 427 3362</span>
          </div>
        </div>
      )}
    </header>
  );
}
