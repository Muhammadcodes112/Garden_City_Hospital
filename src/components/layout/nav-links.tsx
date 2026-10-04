"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { useSession } from "@/lib/auth-client";
import { useMessagesPoll } from "@/hooks/use-messages-poll";
import { ShieldCheck } from "lucide-react";

export function NavLinks({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { unreadTotal } = useMessagesPoll();
  const isSuperAdmin = (session?.user as { role?: string } | undefined)?.role === "super_admin";

  const items = [
    ...NAV_ITEMS,
    ...(isSuperAdmin ? [{ href: "/admins", label: "Admins", icon: ShieldCheck }] : []),
  ];

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-green text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {item.href === "/messages" && unreadTotal > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1.5 text-[10px] font-bold text-white">
                {unreadTotal > 99 ? "99+" : unreadTotal}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
