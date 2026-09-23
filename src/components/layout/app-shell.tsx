"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import Image from "next/image";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";
import { GlobalSearch } from "@/components/search/global-search";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { pageTitleForPath } from "@/lib/routes";
import { useRouter } from "next/navigation";
import { HOSPITAL_NAME } from "@/lib/brand";

export function AppShell({
  userName,
  userEmail,
  children,
}: {
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const pageTitle = pageTitleForPath(pathname);
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop sidebar — fixed from lg up */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-brand-black px-4 py-6 lg:flex">
        <SidebarBrand />
        <NavLinks className="mt-8 flex-1" />
        <div className="mt-auto border-t border-white/10 pt-4">
          <p className="truncate text-xs font-medium text-white/90">{userName}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="mt-2 w-full justify-start gap-2 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-card">
          <div
            className="h-1 w-full bg-gradient-to-r from-brand-black via-brand-red to-brand-orange"
            aria-hidden
          />
          <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 lg:hidden"
                    aria-label="Open navigation menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="flex flex-col">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="px-2 pt-2">
                    <SidebarBrand compact />
                  </div>
                  <NavLinks onNavigate={() => setOpen(false)} className="mt-6 flex-1 px-2" />
                  <div className="mt-auto border-t border-white/10 px-2 pb-2 pt-4">
                    <p className="truncate text-xs text-white/70">{userName}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSignOut}
                      className="mt-2 w-full justify-start gap-2 text-white/80 hover:bg-white/10 hover:text-white"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              <h1 className="truncate text-lg font-semibold text-foreground">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-3">
              <GlobalSearch />
              <UserMenu userName={userName} userEmail={userEmail} />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/brand/logo-mark-dark.svg"
        alt={HOSPITAL_NAME}
        width={compact ? 36 : 44}
        height={compact ? 36 : 44}
        className="shrink-0 rounded-sm bg-white/10 p-0.5"
      />
      {!compact && (
        <Image
          src="/brand/wordmark-dark.png"
          alt={HOSPITAL_NAME}
          width={160}
          height={36}
          className="h-auto w-32"
        />
      )}
    </div>
  );
}
