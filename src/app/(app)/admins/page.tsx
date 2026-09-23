"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  UserPlus,
  Shield,
  Search,
  Trash2,
  AlertTriangle,
  FileText,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccessCodeCard } from "@/components/admin/access-code-card";
import { formatDate } from "@/lib/date";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  deletedAt: string | null;
  banned: boolean;
  status: "active" | "banned" | "deleted";
  formsCount: number;
  lastActiveAt: string | null;
  isSuperAdmin: boolean;
};

type Stats = {
  totalAdmins: number;
  activeThisWeek: number;
  newThisMonth: number;
};

export default function AdminsManagementPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [confirmEmailInput, setConfirmEmailInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function fetchAdminData() {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const json = await res.json();
        setStats(json.stats);
        setUsers(json.users || []);
      } else if (res.status === 403) {
        toast.error("Super Admin access required");
      }
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAdminData();
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
        fetchAdminData();
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error || "Failed to delete admin account");
      }
    } catch {
      toast.error("Failed to delete admin account");
    } finally {
      setDeleting(false);
    }
  }

  const [roleTarget, setRoleTarget] = useState<{ user: AdminUser; newRole: "super_admin" | "admin" } | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  async function handleRoleConfirm() {
    if (!roleTarget) return;
    setUpdatingRole(true);
    try {
      const res = await fetch(`/api/admin/users/${roleTarget.user.id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: roleTarget.newRole }),
      });

      if (res.ok) {
        const json = await res.json();
        const actionLabel = roleTarget.newRole === "super_admin" ? "promoted to Super Admin" : "demoted to Admin";
        toast.success(`Account for ${json.user.email} ${actionLabel}.`);
        setRoleTarget(null);
        fetchAdminData();
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error || "Failed to update role");
      }
    } catch {
      toast.error("Failed to update user role");
    } finally {
      setUpdatingRole(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto">
      {/* TITLE BANNER */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Admin Management &amp; Security
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Super Admin Control Center: Access codes, privileges, and admin accounts.
        </p>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Total Admins</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-foreground">
            {loading ? "..." : stats?.totalAdmins ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">Registered active admin accounts</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Active This Week</span>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-foreground">
            {loading ? "..." : stats?.activeThisWeek ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">Logged in within last 7 days</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">New This Month</span>
            <UserPlus className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-foreground">
            {loading ? "..." : stats?.newThisMonth ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">Joined in last 30 days</p>
        </div>
      </div>

      {/* ACCESS CODE CARD */}
      <AccessCodeCard />

      {/* ADMINS TABLE & MANAGEMENT */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Admin Accounts</h3>
            <p className="text-xs text-muted-foreground">
              Manage accounts, view activity, promote roles, or revoke admin privileges.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
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

        {/* TABLE (DESKTOP) */}
        <div className="hidden xl:block overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-bold">
              <tr>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Last Active</th>
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
                    {u.isSuperAdmin ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Shield className="h-3 w-3" /> SUPER ADMIN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        ADMIN
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.status === "deleted" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-semibold">
                        <XCircle className="h-3.5 w-3.5" /> Former Admin
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
                    {u.lastActiveAt ? formatDate(u.lastActiveAt) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-foreground">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" /> {u.formsCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.status !== "deleted" ? (
                      <div className="flex items-center justify-end gap-1">
                        {!u.isSuperAdmin ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-amber-500/30"
                            onClick={() => setRoleTarget({ user: u, newRole: "super_admin" })}
                          >
                            <Shield className="h-3.5 w-3.5 mr-1" /> Make Super Admin
                          </Button>
                        ) : (
                          u.email.toLowerCase() !== "funguyallen@gmail.com" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs text-slate-600 dark:text-slate-400"
                              onClick={() => setRoleTarget({ user: u, newRole: "admin" })}
                            >
                              Demote to Admin
                            </Button>
                          )
                        )}

                        {!u.isSuperAdmin && (
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
                {u.isSuperAdmin ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    SUPER ADMIN
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    ADMIN
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                <span>Forms: {u.formsCount}</span>
                <span>Joined: {formatDate(u.createdAt)}</span>
              </div>
              {u.status !== "deleted" ? (
                <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                  {!u.isSuperAdmin ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      onClick={() => setRoleTarget({ user: u, newRole: "super_admin" })}
                    >
                      <Shield className="h-3.5 w-3.5 mr-1" /> Make Super Admin
                    </Button>
                  ) : (
                    u.email.toLowerCase() !== "funguyallen@gmail.com" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => setRoleTarget({ user: u, newRole: "admin" })}
                      >
                        Demote to Admin
                      </Button>
                    )
                  )}

                  {!u.isSuperAdmin && (
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

      {/* ROLE PROMOTION / DEMOTION DIALOG */}
      <DialogPrimitive.Root open={Boolean(roleTarget)} onOpenChange={(open: boolean) => !open && setRoleTarget(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,95vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-card p-6 shadow-xl outline-none">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 mb-3">
              <Shield className="h-6 w-6" />
              <DialogPrimitive.Title className="text-base font-bold text-foreground">
                {roleTarget?.newRole === "super_admin" ? "Promote to Super Admin" : "Demote to Admin"}
              </DialogPrimitive.Title>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
              {roleTarget?.newRole === "super_admin" ? (
                <>
                  Are you sure you want to promote <strong>{roleTarget.user.name}</strong> (
                  <span className="font-mono text-foreground">{roleTarget.user.email}</span>) to{" "}
                  <strong>Super Admin</strong>? They will gain full administrative privileges including managing admin accounts, viewing activity logs, and controlling access codes.
                </>
              ) : (
                <>
                  Are you sure you want to demote <strong>{roleTarget?.user.name}</strong> back to standard <strong>Admin</strong> role?
                </>
              )}
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRoleTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={roleTarget?.newRole === "super_admin" ? "default" : "outline"}
                size="sm"
                disabled={updatingRole}
                onClick={handleRoleConfirm}
                className={roleTarget?.newRole === "super_admin" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
              >
                {updatingRole ? "Updating Role..." : roleTarget?.newRole === "super_admin" ? "Confirm Super Admin Promotion" : "Confirm Demotion"}
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
                Delete Admin Account
              </DialogPrimitive.Title>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              This action will <strong>revoke all active sessions</strong> for <strong>{deleteTarget?.name}</strong> immediately and soft-delete the account. Medical records created by them will be <strong>retained for compliance</strong> and tagged as <em>(former admin)</em>.
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
