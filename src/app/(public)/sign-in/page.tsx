"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthLayout } from "@/components/layout/auth-layout";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Set once the password is accepted for an account with 2FA on.
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  /** Role-aware destination, honouring a safe same-origin ?redirect= param. */
  function goHome(user: unknown) {
    const role = (user as { role?: string } | undefined)?.role;
    let target = role === "patient" ? "/patient" : "/dashboard";
    const redirectParam = new URLSearchParams(window.location.search).get("redirect");
    if (redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")) {
      target = redirectParam;
    }
    // Direct window navigation guarantees session cookies are sent immediately
    // on the initial request, bypassing Next.js client-side router cache races.
    window.location.href = target;
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: verifyError } = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
        : await authClient.twoFactor.verifyTotp({ code: code.trim() });
      if (verifyError) {
        setLoading(false);
        setError(
          verifyError.status === 429
            ? "Too many attempts. Please wait a minute and try again."
            : verifyError.message ?? "That code didn't match.",
        );
        return;
      }
      goHome(data?.user);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setLoading(false);
        setError(
          signInError.status === 429
            ? "Too many attempts. Please wait a minute and try again."
            : signInError.message ?? "Invalid email or password.",
        );
        return;
      }

      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
        setLoading(false);
        setNeedsCode(true);
        return;
      }

      goHome(data?.user);
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || "Sign in failed. Please try again.");
    }
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Sign In</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to your Garden City Specialist Hospital account.
        </p>
      </div>

      {needsCode ? (
        <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">{useBackupCode ? "Backup code" : "Authenticator code"}</Label>
            <Input
              id="code"
              autoFocus
              autoComplete="one-time-code"
              inputMode={useBackupCode ? "text" : "numeric"}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {useBackupCode
                ? "Enter one of the backup codes you saved when you turned on 2FA."
                : "Open your authenticator app and enter the 6-digit code for Garden City."}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Verifying..." : "Verify"}
          </Button>
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => {
              setUseBackupCode((v) => !v);
              setCode("");
              setError(null);
            }}
          >
            {useBackupCode ? "Use authenticator app instead" : "Lost your phone? Use a backup code"}
          </button>
        </form>
      ) : (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
