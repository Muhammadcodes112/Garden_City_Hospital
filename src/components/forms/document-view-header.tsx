"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formEditHref } from "@/lib/routes";
import type { FormType } from "@/lib/validators/form-data";

export function DocumentViewHeader({
  patientName,
  hospitalNumber,
  formTypeLabel,
  status,
  recordId,
  formType,
  isSuperAdmin,
}: {
  patientName: string;
  hospitalNumber: string;
  formTypeLabel: string;
  status: "draft" | "completed";
  recordId: string;
  formType: FormType;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0 text-slate-300 hover:bg-slate-800 hover:text-white"
        onClick={() => router.back()}
        aria-label="Back"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {formTypeLabel} — {patientName}
        </p>
        <p className="truncate text-xs text-slate-400">{hospitalNumber}</p>
      </div>
      <Badge variant={status} className="shrink-0">
        {status === "draft" ? "Draft" : "Completed"}
      </Badge>
      {isSuperAdmin && (
        <Button
          asChild
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
        >
          <Link href={formEditHref(formType, recordId)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
        </Button>
      )}
    </div>
  );
}
