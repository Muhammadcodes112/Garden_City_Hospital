"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  Check,
  MessageCircle,
  RefreshCw,
  Clock,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/date";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";

type AccessCodeInfo = {
  code: string;
  periodSeconds: number;
  anchorAt: string;
  version: number;
  updatedAt: string;
  nextRotationAt: string;
  secondsRemaining: number;
  formattedCountdown: string;
  isUnder24Hours: boolean;
};

type FailedSignup = {
  id: string;
  ipAddress: string | null;
  email: string | null;
  reason: string | null;
  createdAt: string;
};

export function AccessCodeCard() {
  const [data, setData] = useState<AccessCodeInfo | null>(null);
  const [failures, setFailures] = useState<FailedSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(2592000);
  const [customDays, setCustomDays] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  async function fetchCodeInfo() {
    try {
      const res = await fetch("/api/admin/access-code");
      if (res.ok) {
        const json = await res.json();
        setData(json.accessCode);
        setFailures(json.recentFailures || []);
        setSelectedPeriod(json.accessCode.periodSeconds);
        setSecondsLeft(json.accessCode.secondsRemaining);
      }
    } catch (err) {
      console.error("Failed to fetch access code:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCodeInfo();
  }, []);

  // Live countdown timer when under 24 hours
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          fetchCodeInfo();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  function handleCopy() {
    if (!data) return;
    navigator.clipboard.writeText(data.code);
    setCopied(true);
    toast.success("Access code copied to clipboard");
    setTimeout(() => setCopied(false), 2500);
  }

  function handleWhatsAppShare() {
    if (!data) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const signUpUrl = `${origin}/sign-up`;
    const message = `Here is your Admin Access Code for Garden City Specialist Hospital:\n\nCode: ${data.code}\nSign-up link: ${signUpUrl}\n\nNote: ${data.formattedCountdown}.`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  }

  async function handlePeriodChange(seconds: number) {
    setUpdating(true);
    try {
      const res = await fetch("/api/admin/access-code/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "period", periodSeconds: seconds }),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.accessCode);
        setSelectedPeriod(json.accessCode.periodSeconds);
        setSecondsLeft(json.accessCode.secondsRemaining);
        toast.success("Rotation period updated & code anchor reset");
      } else {
        toast.error("Failed to update rotation period");
      }
    } catch {
      toast.error("Failed to update rotation period");
    } finally {
      setUpdating(false);
    }
  }

  async function handleRegenerateNow() {
    setUpdating(true);
    setRegenOpen(false);
    try {
      const res = await fetch("/api/admin/access-code/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.accessCode);
        setSecondsLeft(json.accessCode.secondsRemaining);
        toast.success("Access code regenerated! The previous code is now void.");
      } else {
        toast.error("Failed to regenerate access code");
      }
    } catch {
      toast.error("Failed to regenerate access code");
    } finally {
      setUpdating(false);
    }
  }

  // Circular progress calculation
  const totalPeriod = data?.periodSeconds || 2592000;
  const progressPercent = Math.min(100, Math.max(0, (secondsLeft / totalPeriod) * 100));
  const strokeDashoffset = 283 - (283 * progressPercent) / 100;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-pulse space-y-4">
        <div className="h-5 w-48 bg-muted rounded" />
        <div className="h-16 w-full bg-muted rounded" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6 text-foreground">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary shrink-0" /> Rotating Admin Access Code
          </h3>
          <p className="text-xs text-muted-foreground">
            Gates new admin sign-ups. Only visible to Super Admin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 flex-1 sm:flex-none"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Code"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 flex-1 sm:flex-none text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            onClick={handleWhatsAppShare}
          >
            <MessageCircle className="h-3.5 w-3.5" /> Share WhatsApp
          </Button>
        </div>
      </div>

      {/* CODE DISPLAY & CIRCULAR COUNTDOWN RING */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center rounded-lg border border-border bg-muted/30 p-4 sm:p-5">
        {/* Monospace Code */}
        <div className="md:col-span-2 flex flex-col items-center md:items-start space-y-2 min-w-0 w-full">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Current Access Code
          </span>
          <div className="text-xl sm:text-3xl md:text-4xl font-mono font-extrabold tracking-wider sm:tracking-widest text-primary bg-background px-3 sm:px-5 py-2.5 rounded-lg border border-border shadow-inner text-center md:text-left break-all max-w-full">
            {data.code}
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1 text-center md:text-left">
            <span>Version: #{data.version}</span>
            <span>·</span>
            <span>Last Updated: {formatDate(data.updatedAt)}</span>
          </div>
        </div>

        {/* Circular Countdown Ring */}
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                className="stroke-muted"
                strokeWidth="7"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                className="stroke-primary transition-all duration-1000 ease-linear"
                strokeWidth="7"
                strokeDasharray="283"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1">
              <span className="text-[11px] font-bold text-foreground leading-tight">
                {data.isUnder24Hours ? `${Math.floor(secondsLeft / 3600)}h ${Math.floor((secondsLeft % 3600) / 60)}m` : `${Math.floor(secondsLeft / 86400)}d`}
              </span>
              <span className="text-[9px] text-muted-foreground">left</span>
            </div>
          </div>
          <span className="text-xs font-medium text-muted-foreground text-center">
            {data.formattedCountdown}
          </span>
        </div>
      </div>

      {/* ROTATION SETTINGS & REGENERATE BUTTON */}
      <div className="space-y-3 pt-2">
        <Label className="text-xs font-semibold text-foreground">
          Rotation Period &amp; Manual Override
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={selectedPeriod === 86400 && !showCustomInput ? "default" : "outline"}
            className="text-xs flex-1 sm:flex-none"
            disabled={updating}
            onClick={() => {
              setShowCustomInput(false);
              handlePeriodChange(86400);
            }}
          >
            1 Day
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selectedPeriod === 604800 && !showCustomInput ? "default" : "outline"}
            className="text-xs flex-1 sm:flex-none"
            disabled={updating}
            onClick={() => {
              setShowCustomInput(false);
              handlePeriodChange(604800);
            }}
          >
            7 Days
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selectedPeriod === 1209600 && !showCustomInput ? "default" : "outline"}
            className="text-xs flex-1 sm:flex-none"
            disabled={updating}
            onClick={() => {
              setShowCustomInput(false);
              handlePeriodChange(1209600);
            }}
          >
            14 Days
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selectedPeriod === 2592000 && !showCustomInput ? "default" : "outline"}
            className="text-xs flex-1 sm:flex-none"
            disabled={updating}
            onClick={() => {
              setShowCustomInput(false);
              handlePeriodChange(2592000);
            }}
          >
            30 Days (Default)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={showCustomInput ? "default" : "outline"}
            className="text-xs flex-1 sm:flex-none"
            onClick={() => setShowCustomInput(!showCustomInput)}
          >
            Custom...
          </Button>

          {/* Regenerate Button */}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="w-full sm:w-auto sm:ml-auto text-xs gap-1.5 mt-2 sm:mt-0"
            disabled={updating}
            onClick={() => setRegenOpen(true)}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate Now
          </Button>
        </div>

        {/* Custom Days Input */}
        {showCustomInput ? (
          <div className="flex items-center gap-2 pt-2">
            <input
              type="number"
              min="1"
              max="90"
              placeholder="Days (1 - 90)"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1 text-xs w-36"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const days = parseInt(customDays, 10);
                if (days >= 1 && days <= 90) {
                  handlePeriodChange(days * 86400);
                } else {
                  toast.error("Please enter days between 1 and 90");
                }
              }}
            >
              Apply Custom
            </Button>
          </div>
        ) : null}
      </div>

      {/* FAILED SIGN-UP ATTEMPTS LOG TABLE */}
      {failures.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-4">
          <h4 className="text-xs font-bold text-destructive flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" /> Failed Sign-Up Attempts (Last 7 Days)
          </h4>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-semibold">
                <tr>
                  <th className="px-3 py-2">Date / Time</th>
                  <th className="px-3 py-2">IP Address</th>
                  <th className="px-3 py-2">Target Email</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {failures.map((f) => (
                  <tr key={f.id} className="hover:bg-muted/30">
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">
                      {formatDate(f.createdAt)}
                    </td>
                    <td className="px-3 py-1.5 font-mono">{f.ipAddress || "N/A"}</td>
                    <td className="px-3 py-1.5">{f.email || "N/A"}</td>
                    <td className="px-3 py-1.5 text-destructive">{f.reason || "Invalid code"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* REGENERATE CONFIRMATION DIALOG */}
      <DialogPrimitive.Root open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,95vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-card p-6 shadow-xl outline-none">
            <div className="flex items-center gap-3 text-destructive mb-3">
              <AlertTriangle className="h-6 w-6" />
              <DialogPrimitive.Title className="text-base font-bold text-foreground">
                Regenerate Access Code Immediately?
              </DialogPrimitive.Title>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
              This will increment the code version and reset the anchor timestamp. The current access code will be <strong>voided immediately</strong> and cannot be used for any new admin sign-ups.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRegenOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handleRegenerateNow}>
                Regenerate Code Now
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
