"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FileText, FlaskConical, Pill, Search, Users, FileCheck, FilePen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/date";
import { HOSPITAL_NAME, TAGLINE } from "@/lib/brand";
import {
  FORM_TYPE_LABELS,
  formEditHref,
  formNewHref,
} from "@/lib/routes";
import type { DashboardStats } from "@/lib/dashboard";

export type RecentFormItem = {
  id: string;
  type: "lab" | "prescription" | "medical_report";
  status: "draft" | "completed";
  updatedAt: string;
  surname: string;
  firstNames: string;
  hospitalNumber: string;
};

type Props = {
  userName: string;
  todayLabel: string;
  stats: DashboardStats;
  recentForms: RecentFormItem[];
};

export function DashboardView({ userName, todayLabel, stats, recentForms }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recentForms;
    return recentForms.filter((row) => {
      const name = `${row.surname} ${row.firstNames}`.toLowerCase();
      return name.includes(q) || row.hospitalNumber.toLowerCase().includes(q);
    });
  }, [query, recentForms]);

  return (
    <div className="flex flex-col gap-8">
      <WelcomeBanner userName={userName} todayLabel={todayLabel} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Forms created today"
          value={stats.formsCreatedToday}
          icon={FilePen}
        />
        <StatCard label="Drafts in progress" value={stats.draftsInProgress} icon={FileText} />
        <StatCard
          label="Completed this week"
          value={stats.completedThisWeek}
          icon={FileCheck}
        />
        <StatCard label="Total patients" value={stats.totalPatients} icon={Users} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Quick actions
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button asChild>
            <Link href={formNewHref("lab")} prefetch={false}>
              <FlaskConical className="h-4 w-4" />
              New Lab Request
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={formNewHref("prescription")} prefetch={false}>
              <Pill className="h-4 w-4" />
              New Prescription
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={formNewHref("medical_report")} prefetch={false}>
              <FileText className="h-4 w-4" />
              New Medical Report
            </Link>
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader className="gap-4 space-y-0 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Recent forms</CardTitle>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name or hospital no."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              aria-label="Search recent forms by patient name or hospital number"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filtered.length === 0 ? (
            <EmptyRecent hasQuery={query.trim().length > 0} />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Patient</th>
                      <th className="pb-2 pr-4 font-medium">Hospital no.</th>
                      <th className="pb-2 pr-4 font-medium">Form type</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 pr-4 font-medium">Last updated</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <RecentRow key={row.id} row={row} layout="table" />
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="flex flex-col gap-3 md:hidden">
                {filtered.map((row) => (
                  <li key={row.id}>
                    <RecentRow row={row} layout="card" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WelcomeBanner({ userName, todayLabel }: { userName: string; todayLabel: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-brand-green px-6 py-8 text-white shadow-sm">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Cpath d='M28 16h8v12h12v8H36v12h-8V36H16v-8h12z' fill='%23ffffff' fill-opacity='0.08'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
        }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome to {HOSPITAL_NAME}
          </h2>
          <p className="text-sm text-white/85">{TAGLINE}</p>
          <p className="text-sm text-white/90">
            Signed in as <span className="font-semibold">{userName}</span>
            <span className="text-white/70"> · {todayLabel}</span>
          </p>
        </div>
        <Image
          src="/brand/logo-mark.png"
          alt=""
          width={80}
          height={80}
          className="hidden h-20 w-20 shrink-0 rounded-md bg-white/15 p-2 sm:block"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{value}</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function RecentRow({
  row,
  layout,
}: {
  row: RecentFormItem;
  layout: "table" | "card";
}) {
  const patientName = `${row.surname} ${row.firstNames}`;
  const typeLabel = FORM_TYPE_LABELS[row.type];
  const updated = formatDate(row.updatedAt);
  const isDraft = row.status === "draft";

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {isDraft ? (
        <Button asChild size="sm" variant="default">
          <Link href={formEditHref(row.type, row.id)}>Continue</Link>
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline">
          <Link href={formEditHref(row.type, row.id)}>View</Link>
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={isDraft}
        title={isDraft ? "Complete the form to preview PDF" : "PDF export coming soon"}
        className="text-muted-foreground"
      >
        Preview PDF
      </Button>
    </div>
  );

  if (layout === "card") {
    return (
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-foreground">{patientName}</p>
            <p className="text-xs text-muted-foreground">{row.hospitalNumber}</p>
          </div>
          <Badge variant={isDraft ? "draft" : "completed"}>
            {isDraft ? "Draft" : "Completed"}
          </Badge>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground/80">Form</dt>
            <dd>{typeLabel}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground/80">Updated</dt>
            <dd>{updated}</dd>
          </div>
        </dl>
        <div className="mt-3 border-t border-border pt-3">{actions}</div>
      </div>
    );
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pr-4 font-medium text-foreground">{patientName}</td>
      <td className="py-3 pr-4 text-muted-foreground">{row.hospitalNumber}</td>
      <td className="py-3 pr-4">{typeLabel}</td>
      <td className="py-3 pr-4">
        <Badge variant={isDraft ? "draft" : "completed"}>
          {isDraft ? "Draft" : "Completed"}
        </Badge>
      </td>
      <td className="py-3 pr-4 text-muted-foreground">{updated}</td>
      <td className="py-3">{actions}</td>
    </tr>
  );
}

function EmptyRecent({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <FileText className="h-10 w-10 text-muted-foreground/60" />
      <p className="mt-3 text-sm font-medium text-foreground">
        {hasQuery ? "No forms match your search" : "No forms yet"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasQuery
          ? "Try a different patient name or hospital number."
          : "Create a lab request, prescription, or medical report to see it here."}
      </p>
    </div>
  );
}
