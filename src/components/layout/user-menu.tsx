"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, Moon, PenTool, ShieldCheck, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { initialsFromName } from "@/lib/brand";
import { useTheme } from "@/components/theme/theme-provider";
import { SignatureSettingsModal } from "@/components/account/signature-settings-modal";
import { TwoFactorSettingsModal } from "@/components/account/two-factor-settings-modal";

export function UserMenu({
  userName,
  userEmail,
  initialSignatureUrl = null,
}: {
  userName: string;
  userEmail: string;
  initialSignatureUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState(initialSignatureUrl);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const initials = initialsFromName(userName || userEmail);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground",
          "ring-2 ring-transparent transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-ring",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        {initials}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              toggleTheme();
            }}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              setOpen(false);
              setSignatureModalOpen(true);
            }}
          >
            <PenTool className="h-4 w-4" />
            My signature
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              setOpen(false);
              setTwoFactorModalOpen(true);
            }}
          >
            <ShieldCheck className="h-4 w-4" />
            Two-factor authentication
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : null}

      <SignatureSettingsModal
        open={signatureModalOpen}
        onOpenChange={setSignatureModalOpen}
        signatureUrl={signatureUrl}
        onUpdated={setSignatureUrl}
      />
      <TwoFactorSettingsModal open={twoFactorModalOpen} onOpenChange={setTwoFactorModalOpen} />
    </div>
  );
}
