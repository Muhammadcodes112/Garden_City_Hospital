"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Shield,
  ShieldCheck,
  Search,
  Trash2,
  AlertTriangle,
  FileText,
  CheckCircle,
  XCircle,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AccessCodeCard } from "@/components/admin/access-code-card";
import { formatDate } from "@/lib/date";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";

type Role = "patient" | "admin" | "super_admin";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  deletedAt: string | null;
  banned: boolean;
  status: "active" | "banned" | "deleted";
  formsCount: number;
  lastActiveAt: string | null;
  lastSignInAt: string | null;
  twoFactorEnabled: boolean;
};

const ROLE_LABEL: Record<Role, string> = {
  patient: "Patient",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ROLE_BADGE: Record<Role, string> = {
  patient: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  admin: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-transparent",
  super_admin: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

const TIER_CARDS: { role: Role; description: string }[] = [
  { role: "patient", description: "Signs up freely, no code needed. No access to staff tools, patient records, or forms — only their own account." },
  { role: "admin", description: "Hospital staff. Full access to patient records, forms, messages, and the records search — but no access to user management, metrics, or deletion." },
  { role: "super_admin", description: "Everything an Admin can do, plus user management, role changes, access codes, and permanent deletion. Requires 2FA before promotion." },
];

export default function UsersAndRolesPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [confirmEmailInput, setConfirmEmailInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const json = await res.json();
        setUsers(json.users || []);
      } else if (res.status === 403) {
        toast.error("Super Admin access required");
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    if (confirmEmailInput.trim().toLowerCase() !== deleteTarget.email.toLowerCase()) {
      toast.error("Email confirmation does not match target email");
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: confirmEmailInput }),
      });

      if (res.ok) {
        toast.success(`Account for ${deleteTarget.email} deleted and sessions revoked.`);
        setDeleteTarget(null);
        setConfirmEmailInput("");
        fetchUsers();
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error || "Failed to delete account");
      }
    } catch {
      toast.error("Failed to delete account");
    } finally {
      setDeleting(false);
    }
  }

  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState<Role>("admin");
  const [reason, setReason] = useState("");
  const [updatingRole, setUpdatingRole] = useState(false);

  function openRoleDialog(u: AdminUser) {
    setRoleTarget(u);
    setNewRole(u.role);
    setReason("");
  }

  const needs2faWarning = newRole === "super_admin" && roleTarget && !roleTarget.twoFactorEnabled;

  async function handleRoleConfirm() {
    if (!roleTarget) return;
    if (newRole === roleTarget.role) {
      toast.error("Pick a different role, or close this dialog");
      return;
    }
    if (!reason.trim()) {
      toast.error("A reason is required");
      return;
    }

    setUpdatingRole(true);
    try {
      const res = await fetch(`/api/admin/users/${roleTarget.id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole, reason: reason.trim() }),
      });

      if (res.ok) {
        const json = await res.json();
        toast.success(`${json.user.email} is now ${ROLE_LABEL[newRole as Role]}.`);
        setRoleTarget(null);
        fetchUsers();
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error || "Failed to update role");
      }
    } catch {
      toast.error("Failed to update role");
    } finally {
      setUpdatingRole(false);
    }
  }

  const counts = useMemo(() => {
    const c: Record<Role, number> = { patient: 0, admin: 0, super_admin: 0 };
    for (const u of users) {
      if (u.status === "deleted") continue;
      c[u.role] = (c[u.role] || 0) + 1;
    }
    return c;
  }, [users]);

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    const matchesSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <UserCog className="h-6 w-6 text-primary" /> Users &amp; Roles
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage every account — patients and hospital staff — and who can do what.
        </p>
      </div>

      {/* TIER CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TIER_CARDS.map(({ role, description }) => (
          <div key={role} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${ROLE_BADGE[role]}`}>
                {role === "super_admin" && <Shield className="h-3 w-3" />}
                {ROLE_LABEL[role].toUpperCase()}
              </span>
              <span className="text-2xl font-extrabold text-foreground tabular-nums">
                {loading ? "..." : counts[role]}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
          </div>
        ))}
      </div>

      <AccessCodeCard />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">All Accounts</h3>
            <p className="text-xs text-muted-foreground">
              Search, filter by role, and change roles with an audited reason.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs font-semibold overflow-x-auto">
              {(["all", "patient", "admin", "super_admin"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${roleFilter === r ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {r === "all" ? "All" : ROLE_LABEL[r]}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
          </div>
        </div>

        {/* TABLE (DESKTOP) */}
        <div className="hidden xl:block overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-bold">
              <tr>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Last Sign-In</th>
                <th className="px-4 py-3 text-center">2FA</th>
                <th className="px-4 py-3 text-center">Forms Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{u.name}</div>
                    <div className="text-muted-foreground text-[11px]">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${ROLE_BADGE[u.role]}`}>
                      {u.role === "super_admin" && <Shield className="h-3 w-3" />}
                      {ROLE_LABEL[u.role].toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.status === "deleted" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-semibold">
                        <XCircle className="h-3.5 w-3.5" /> Deleted
                      </span>
                    ) : u.status === "banned" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-red-500 font-semibold">
                        <XCircle className="h-3.5 w-3.5" /> Banned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle className="h-3.5 w-3.5" /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.lastSignInAt ? formatDate(u.lastSignInAt) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.twoFactorEnabled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle className="h-3.5 w-3.5" /> On
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" /> Off
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-foreground">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" /> {u.formsCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.status !== "deleted" ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => openRoleDialog(u)}
                        >
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Change role
                        </Button>
                        {u.role !== "super_admin" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => {
                              setDeleteTarget(u);
                              setConfirmEmailInput("");
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">Protected</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* STACKED CARDS (MOBILE & TABLET) */}
        <div className="xl:hidden space-y-3">
          {filteredUsers.map((u) => (
            <div key={u.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-sm text-foreground">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${ROLE_BADGE[u.role]}`}>
                  {ROLE_LABEL[u.role].toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                <span>Forms: {u.formsCount}</span>
                <span>Joined: {formatDate(u.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Last sign-in: {u.lastSignInAt ? formatDate(u.lastSignInAt) : "Never"}</span>
                <span className={u.twoFactorEnabled ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                  2FA: {u.twoFactorEnabled ? "On" : "Off"}
                </span>
              </div>
              {u.status !== "deleted" ? (
                <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" className="text-xs h-7" onClick={() => openRoleDialog(u)}>
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Change role
                  </Button>
                  {u.role !== "super_admin" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="text-xs h-7"
                      onClick={() => {
                        setDeleteTarget(u);
                        setConfirmEmailInput("");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* CHANGE ROLE DIALOG */}
      <DialogPrimitive.Root open={Boolean(roleTarget)} onOpenChange={(open: boolean) => !open && setRoleTarget(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,95vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-card p-6 shadow-xl outline-none">
            <div className="flex items-center gap-3 text-foreground mb-3">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <DialogPrimitive.Title className="text-base font-bold text-foreground">
                Change role — {roleTarget?.name}
              </DialogPrimitive.Title>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              <span className="font-mono text-foreground">{roleTarget?.email}</span> is currently{" "}
              <strong>{roleTarget ? ROLE_LABEL[roleTarget.role] : ""}</strong>.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">New role</Label>
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs font-semibold">
                  {(["patient", "admin", "super_admin"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNewRole(r)}
                      className={`flex-1 px-3 py-1.5 rounded-md transition-all ${newRole === r ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>

              {needs2faWarning && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    This account must enable two-factor authentication before it can be promoted to Super Admin. Ask them to enable 2FA first.
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="reason" className="text-xs font-semibold">
                  Reason <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this role changing?"
                  className="text-xs"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <Button type="button" variant="outline" size="sm" onClick={() => setRoleTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={updatingRole || newRole === roleTarget?.role || !reason.trim() || Boolean(needs2faWarning)}
                onClick={handleRoleConfirm}
              >
                {updatingRole ? "Updating..." : "Confirm role change"}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* DELETE CONFIRMATION DIALOG */}
      <DialogPrimitive.Root open={Boolean(deleteTarget)} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,95vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-card p-6 shadow-xl outline-none">
            <div className="flex items-center gap-3 text-destructive mb-3">
              <AlertTriangle className="h-6 w-6" />
              <DialogPrimitive.Title className="text-base font-bold text-foreground">
                Delete Account
              </DialogPrimitive.Title>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              This action will <strong>revoke all active sessions</strong> for <strong>{deleteTarget?.name}</strong> immediately and soft-delete the account. Medical records created by them (if any) will be <strong>retained for compliance</strong>.
            </p>
            <div className="space-y-2 mb-6">
              <Label htmlFor="confirmEmail" className="text-xs font-semibold text-foreground">
                Type <span className="font-mono font-bold text-destructive">{deleteTarget?.email}</span> to confirm:
              </Label>
              <Input
                id="confirmEmail"
                type="email"
                placeholder={deleteTarget?.email}
                value={confirmEmailInput}
                onChange={(e) => setConfirmEmailInput(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting || confirmEmailInput.trim().toLowerCase() !== deleteTarget?.email.toLowerCase()}
                onClick={handleDeleteConfirm}
              >
                {deleting ? "Deleting Account..." : "Confirm Account Deletion"}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
