"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  AlertTriangle,
  Trash2,
  Moon,
  Search,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  User,
  Shield,
  ShieldAlert,
  Info,
  Clock,
  ExternalLink,
  FilterX,
  Lock,
  FileText,
  Share2,
  MessageSquare,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getActivityEvents,
  getActivitySignals,
  type ActivityEventItem,
  type SignalsData,
  type ActorOption,
  type ActivityFilters,
} from "@/lib/actions/activity-actions";
import { toast } from "sonner";
import Link from "next/link";

type Props = {
  initialSignals: SignalsData;
  initialCounts: Record<string, number>;
  initialActors: ActorOption[];
  initialEvents: ActivityEventItem[];
  initialHasMore: boolean;
  initialNextCursor: string | null;
};

const CATEGORY_TABS = [
  { id: "all", label: "All Events", icon: Activity },
  { id: "auth", label: "Auth", icon: Lock },
  { id: "records", label: "Records", icon: FileText },
  { id: "sharing", label: "Sharing", icon: Share2 },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "appointments", label: "Appointments", icon: Calendar },
  { id: "accounts", label: "Accounts", icon: Key },
] as const;

export function ActivityLogView({
  initialSignals,
  initialCounts,
  initialActors,
  initialEvents,
  initialHasMore,
  initialNextCursor,
}: Props) {
  const [signals, setSignals] = useState<SignalsData>(initialSignals);
  const [events, setEvents] = useState<ActivityEventItem[]>(initialEvents);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedActor, setSelectedActor] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [isPending, startTransition] = useTransition();

  // Active filter count
  const hasActiveFilters =
    selectedCategory !== "all" ||
    searchTerm.trim() !== "" ||
    selectedActor !== "" ||
    fromDate !== "" ||
    toDate !== "";

  function getFilterParams(): ActivityFilters {
    return {
      category: selectedCategory as any,
      search: searchTerm.trim() || undefined,
      actorId: selectedActor || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    };
  }

  function fetchPage(cursor: string | null, isNext = false, isPrev = false) {
    startTransition(async () => {
      try {
        const filters = getFilterParams();
        const res = await getActivityEvents(filters, cursor, 50);
        setEvents(res.items);
        setHasMore(res.hasMore);
        setNextCursor(res.nextCursor);

        if (isNext) {
          setCursorHistory((prev) => [...prev, cursor]);
        } else if (isPrev) {
          setCursorHistory((prev) => prev.slice(0, -1));
        } else {
          // Fresh filter reset history
          setCursorHistory([]);
        }
      } catch (err: any) {
        toast.error("Failed to load activity events");
      }
    });
  }

  function handleFilterSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    fetchPage(null);
  }

  function handleCategoryChange(catId: string) {
    setSelectedCategory(catId);
    startTransition(async () => {
      try {
        const filters = {
          ...getFilterParams(),
          category: catId as any,
        };
        const res = await getActivityEvents(filters, null, 50);
        setEvents(res.items);
        setHasMore(res.hasMore);
        setNextCursor(res.nextCursor);
        setCursorHistory([]);
      } catch {
        toast.error("Failed to filter events");
      }
    });
  }

  function handleClearFilters() {
    setSelectedCategory("all");
    setSearchTerm("");
    setSelectedActor("");
    setFromDate("");
    setToDate("");
    startTransition(async () => {
      try {
        const res = await getActivityEvents({}, null, 50);
        setEvents(res.items);
        setHasMore(res.hasMore);
        setNextCursor(res.nextCursor);
        setCursorHistory([]);
      } catch {
        toast.error("Failed to reset filters");
      }
    });
  }

  async function handleRefresh() {
    startTransition(async () => {
      try {
        const [sig, ev] = await Promise.all([
          getActivitySignals(),
          getActivityEvents(getFilterParams(), null, 50),
        ]);
        setSignals(sig);
        setEvents(ev.items);
        setHasMore(ev.hasMore);
        setNextCursor(ev.nextCursor);
        setCursorHistory([]);
        toast.success("Activity log refreshed");
      } catch {
        toast.error("Failed to refresh activity log");
      }
    });
  }

  function getExportUrl(): string {
    const params = new URLSearchParams();
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (searchTerm.trim()) params.set("search", searchTerm.trim());
    if (selectedActor) params.set("actorId", selectedActor);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    return `/api/admin/activity/export?${params.toString()}`;
  }

  function getEventTagBadge(category: string, action: string) {
    if (action.includes("deleted")) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-900/50">
          <Trash2 className="h-3 w-3" /> {action}
        </span>
      );
    }
    if (action === "signin.failed") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60">
          <ShieldAlert className="h-3 w-3" /> {action}
        </span>
      );
    }
    if (action === "role.changed") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          <Key className="h-3 w-3" /> {action}
        </span>
      );
    }
    if (action.includes("created")) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/50">
          {action}
        </span>
      );
    }
    if (category === "sharing") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-400 border border-sky-200/50 dark:border-sky-900/50">
          <Share2 className="h-3 w-3" /> {action}
        </span>
      );
    }
    if (category === "messages") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/50">
          <MessageSquare className="h-3 w-3" /> {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-border">
        {action}
      </span>
    );
  }

  function getRoleBadge(role: string | null) {
    if (!role) {
      return (
        <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
          GUEST
        </span>
      );
    }
    if (role === "super_admin") {
      return (
        <span className="inline-flex items-center gap-0.5 rounded-sm bg-purple-100 dark:bg-purple-950/80 px-1.5 py-0.2 text-[10px] font-bold text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
          <Shield className="h-2.5 w-2.5" /> SUPER ADMIN
        </span>
      );
    }
    if (role === "admin") {
      return (
        <span className="inline-flex items-center rounded-sm bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          ADMIN
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-sm bg-blue-100 dark:bg-blue-950/80 px-1.5 py-0.2 text-[10px] font-medium text-blue-700 dark:text-blue-300">
        PATIENT
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER ROW */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Activity Log</h1>
            <Badge variant="secondary" className="text-[11px] uppercase tracking-wider font-semibold border border-brand-green/30 text-brand-green bg-brand-green/5">
              Append-Only Audit
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Complete, immutable system audit trail with cryptographic IP snapshots and security signals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isPending}
            className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            asChild
            variant="default"
            size="sm"
            className="h-9 gap-1.5 text-xs font-semibold bg-brand-green hover:bg-brand-green/90 text-white shadow-xs"
          >
            <a href={getExportUrl()} download>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      {/* SIGNALS ROW (4 Cards: Unified aesthetic, glowing gradient icon badges, sleek top accent lines) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Events today */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-slate-700 before:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Events Today</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-white shadow-xs shadow-slate-900/20 ring-4 ring-slate-800/10">
              <Activity className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-foreground">
              {signals.eventsToday.toLocaleString()}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
              in last 24h
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground font-medium">Live hospital activity volume</p>
        </div>

        {/* Card 2: Failed sign-ins (Amber / Orange) */}
        <div className="rounded-2xl border-2 border-[#EA580C] bg-[#FFF7ED] p-5 shadow-xs transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9A3412]">
              Failed Sign-Ins
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EA580C] text-white shadow-xs">
              <ShieldAlert className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-[#172033]">
              {signals.failedSignins.toLocaleString()}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFEDD5] text-[#9A3412] border border-[#EA580C]/40">
              auth anomalies
            </span>
          </div>
          <p className="mt-1.5 text-xs font-medium text-[#9A3412]">
            Targeted emails captured in metadata
          </p>
        </div>

        {/* Card 3: Records deleted (Rose Red) */}
        <div className="rounded-2xl border-2 border-[#E11D48] bg-[#FFF1F2] p-5 shadow-xs transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9F1239]">
              Records Deleted
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E11D48] text-white shadow-xs">
              <Trash2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-[#172033]">
              {signals.recordsDeleted.toLocaleString()}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFE4E6] text-[#9F1239] border border-[#E11D48]/40">
              clinical purges
            </span>
          </div>
          <p className="mt-1.5 text-xs font-medium text-[#9F1239]">
            Includes soft-deletes and trash purges
          </p>
        </div>

        {/* Card 4: After-hours access (Violet) */}
        <div className="rounded-2xl border-2 border-[#7C3AED] bg-[#F5F3FF] p-5 shadow-xs transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B21B6]">
              After-Hours Access
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-xs">
              <Moon className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-[#172033]">
              {signals.afterHoursAccess.toLocaleString()}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EDE9FE] text-[#5B21B6] border border-[#7C3AED]/40">
              22:00–06:00 WAT
            </span>
          </div>
          <p className="mt-1.5 text-xs font-medium text-[#5B21B6]">
            Night-shift or off-hours actions
          </p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-4">
        {/* Category Chips with Counts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const count = initialCounts[tab.id] ?? 0;
            const active = selectedCategory === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleCategoryChange(tab.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-brand-green text-white shadow-xs"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    active ? "bg-white/20 text-white" : "bg-background text-muted-foreground border border-border/80"
                  }`}
                >
                  {count > 99999 ? `${Math.round(count / 1000)}k` : count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Input filters row */}
        <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          {/* Text search */}
          <div className="relative lg:col-span-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search summary, actor, or target ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          {/* Actor select */}
          <div className="lg:col-span-3">
            <select
              value={selectedActor}
              onChange={(e) => setSelectedActor(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs h-9 text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              <option value="">All Actors</option>
              {initialActors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.label} ({actor.role || "user"})
                </option>
              ))}
            </select>
          </div>

          {/* From date */}
          <div className="lg:col-span-2">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="text-xs h-9"
              title="From Date"
            />
          </div>

          {/* To date */}
          <div className="lg:col-span-2">
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="text-xs h-9"
              title="To Date"
            />
          </div>

          {/* Filter action buttons */}
          <div className="flex items-center gap-2 lg:col-span-1">
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="h-9 w-full bg-brand-green hover:bg-brand-green/90 text-white text-xs font-semibold"
            >
              Filter
            </Button>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClearFilters}
                title="Clear filters"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <FilterX className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* TABLE */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Timestamp (WAT)</th>
                <th className="px-4 py-3 whitespace-nowrap">Actor & Role</th>
                <th className="px-4 py-3 whitespace-nowrap">Event Tag</th>
                <th className="px-4 py-3 min-w-[320px]">Event Detail</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Client Info</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <Activity className="mx-auto h-8 w-8 opacity-40 mb-2" />
                    <p className="font-semibold text-foreground">No activity events found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Try widening your search terms or date range.
                    </p>
                  </td>
                </tr>
              ) : (
                events.map((event) => {
                  const isAttention = event.needsAttention;
                  return (
                    <tr
                      key={event.id}
                      className={`transition-colors ${
                        isAttention
                          ? "bg-amber-500/8 dark:bg-amber-950/25 border-l-4 border-l-amber-500 hover:bg-amber-500/12 dark:hover:bg-amber-950/35"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      {/* 1. Date and time to the SECOND in DD/MM/YYYY HH:MM:SS */}
                      <td className="px-4 py-3.5 whitespace-nowrap align-top font-mono text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5 text-foreground font-semibold">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{event.formattedDate}</span>
                        </div>
                        {isAttention && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {event.attentionReasons.map((reason) => (
                              <span
                                key={reason}
                                className="inline-flex items-center rounded-xs bg-amber-500/20 px-1 py-0.2 text-[9px] font-bold text-amber-800 dark:text-amber-300"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* 2. Actor name with a role badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap align-top">
                        <div className="font-semibold text-foreground">
                          {event.actorLabel || "System / Unauthenticated"}
                        </div>
                        <div className="mt-1">{getRoleBadge(event.actorRoleAtTime)}</div>
                      </td>

                      {/* 3. Event as a coloured tag */}
                      <td className="px-4 py-3.5 whitespace-nowrap align-top">
                        {getEventTagBadge(event.category, event.action)}
                      </td>

                      {/* 4. Detail line + target */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="text-foreground font-medium text-xs leading-relaxed">
                          {event.summary}
                        </div>
                        {event.targetId && (
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                            <span className="rounded-xs bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground uppercase font-sans font-semibold">
                              {event.targetType || "target"}
                            </span>
                            <span className="truncate max-w-[200px]">{event.targetId}</span>
                            {event.targetType === "form_record" && (
                              <Link
                                href={`/documents/${event.targetId}`}
                                className="inline-flex items-center gap-0.5 text-brand-green hover:underline font-sans text-[11px]"
                              >
                                View <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 5. Browser + masked IP */}
                      <td className="px-4 py-3.5 whitespace-nowrap align-top text-right text-[11px] text-muted-foreground">
                        <div className="font-medium text-foreground">{event.clientBrowser}</div>
                        <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                          {event.maskedClientIp}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Keyset Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3 bg-muted/20 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Showing {events.length} event{events.length === 1 ? "" : "s"}
            </span>
            {isPending && <span className="text-brand-green font-semibold animate-pulse">Loading…</span>}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cursorHistory.length === 0 || isPending}
              onClick={() => {
                const prevCursor = cursorHistory[cursorHistory.length - 1] ?? null;
                fetchPage(prevCursor, false, true);
              }}
              className="h-8 gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasMore || !nextCursor || isPending}
              onClick={() => {
                if (nextCursor) fetchPage(nextCursor, true, false);
              }}
              className="h-8 gap-1 text-xs font-semibold"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* TWO MANDATORY FOOTNOTES */}
      <div className="rounded-xl border border-border/80 bg-muted/40 p-4 space-y-2 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-brand-green shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold text-foreground">Message privacy guarantee:</span> Message contents are{" "}
            <strong>never recorded</strong> in this log — only sender, recipient, and attachment counts are preserved
            for clinical audit accountability.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-brand-green shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold text-foreground">Data retention policy:</span> Live activity events are
            retained in this database for <strong>90 days</strong>. Every week, a scheduled background job compresses
            records older than 90 days into monthly JSONL archives in Vercel Blob cold storage, verifies line counts,
            and safely purges archived rows.
          </p>
        </div>
      </div>
    </div>
  );
}
