"use client";

import { useState } from "react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Step =
  | { kind: "idle" }
  | { kind: "scan"; qrDataUrl: string; secret: string; backupCodes: string[] }
  | { kind: "backup"; backupCodes: string[] };

export function TwoFactorSettingsModal({ open, onOpenChange }: Props) {
  const { data: session } = authClient.useSession();
  const enabled = Boolean((session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled);

  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close(next: boolean) {
    if (!next) {
      setStep({ kind: "idle" });
      setPassword("");
      setCode("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleStartSetup() {
    setError(null);
    setBusy(true);
    try {
      const { data, error: err } = await authClient.twoFactor.enable({ password });
      if (err || !data || !("totpURI" in data) || !data.totpURI) {
        setError(err?.message ?? "Could not start 2FA setup. Check your password.");
        return;
      }
      const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
      const qrDataUrl = await QRCode.toDataURL(data.totpURI, { width: 220, margin: 1 });
      setPassword("");
      setStep({ kind: "scan", qrDataUrl, secret, backupCodes: data.backupCodes ?? [] });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (step.kind !== "scan") return;
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await authClient.twoFactor.verifyTotp({ code: code.trim() });
      if (err) {
        setError(err.message ?? "That code didn't match. Try the newest code from your app.");
        return;
      }
      setCode("");
      setStep({ kind: "backup", backupCodes: step.backupCodes });
      toast.success("Two-factor authentication is now on");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await authClient.twoFactor.disable({ password });
      if (err) {
        setError(err.message ?? "Could not turn off 2FA. Check your password.");
        return;
      }
      toast.success("Two-factor authentication turned off");
      close(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Two-Factor Authentication
          </DialogTitle>
          <DialogDescription className="text-xs pt-1">
            {step.kind === "scan"
              ? "Scan this QR code with Google Authenticator, Microsoft Authenticator or Authy, then enter the 6-digit code it shows."
              : step.kind === "backup"
                ? "Save these backup codes somewhere safe. Each one can be used once to sign in if you lose your phone."
                : enabled
                  ? "2FA is on. You'll be asked for a code from your authenticator app each time you sign in."
                  : "Add a second step to sign-in: a 6-digit code from an authenticator app on your phone."}
          </DialogDescription>
        </DialogHeader>

        {step.kind === "idle" ? (
          <div className="space-y-1.5">
            <Label htmlFor="tfa-password">Confirm your password</Label>
            <PasswordInput
              id="tfa-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        ) : null}

        {step.kind === "scan" ? (
          <div className="space-y-4">
            {/* White backing so the QR stays scannable in dark mode */}
            <img src={step.qrDataUrl} alt="2FA QR code" className="mx-auto h-[220px] w-[220px] rounded-md bg-white p-2" />
            <p className="text-center text-[11px] text-muted-foreground">
              Can&apos;t scan? Enter this key manually:
              <code className="mt-1 block break-all font-mono text-xs text-foreground">{step.secret}</code>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="tfa-code">6-digit code</Label>
              <Input
                id="tfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
        ) : null}

        {step.kind === "backup" ? (
          <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/40 p-3 font-mono text-sm">
            {step.backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter className="pt-2 gap-2">
          {step.kind === "idle" && !enabled ? (
            <Button type="button" disabled={busy || !password} onClick={handleStartSetup} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Set up 2FA
            </Button>
          ) : null}
          {step.kind === "idle" && enabled ? (
            <Button type="button" variant="destructive" disabled={busy || !password} onClick={handleDisable} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Turn off 2FA
            </Button>
          ) : null}
          {step.kind === "scan" ? (
            <Button type="button" disabled={busy || code.length !== 6} onClick={handleVerify} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Verify &amp; turn on
            </Button>
          ) : null}
          {step.kind === "backup" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(step.backupCodes.join("\n")).then(
                  () => toast.success("Backup codes copied"),
                  () => toast.error("Couldn't copy. Write them down instead."),
                );
              }}
            >
              Copy codes
            </Button>
          ) : null}
          {step.kind === "backup" ? (
            <Button type="button" onClick={() => close(false)}>
              I&apos;ve saved them
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
