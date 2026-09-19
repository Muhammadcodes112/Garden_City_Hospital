import { notFound, redirect } from "next/navigation";
import { listFormRecords } from "@/lib/form-records";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formEditHref, formNewHref } from "@/lib/routes";
import { Pill } from "lucide-react";
import {
  createPrescriptionDraftRecord,
  getPrescriptionFormRecord,
} from "@/lib/actions/prescription-form";
import { PrescriptionFormEditor } from "@/components/prescription/prescription-form-editor";

export const dynamic = "force-dynamic";

export default async function PrescriptionPage(props: {
  searchParams: Promise<{ recordId?: string; new?: string }>;
}) {
  const searchParams = await props.searchParams;

  if (searchParams.new === "1") {
    const { recordId } = await createPrescriptionDraftRecord();
    redirect(`/prescription?recordId=${recordId}`);
  }

  if (searchParams.recordId) {
    const record = await getPrescriptionFormRecord(searchParams.recordId);
    if (!record) {
      notFound();
    }
    return <PrescriptionFormEditor initial={record} />;
  }

  const rows = await listFormRecords("prescription");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Prescriptions</h1>
          <p className="text-sm text-muted-foreground">
            Manage hospital drug prescriptions and print official prescription forms.
          </p>
        </div>
        <Button asChild>
          <Link href={formNewHref("prescription")}>
            <Pill className="mr-2 h-4 w-4" />
            New prescription
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <Pill className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">No prescriptions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Click "New prescription" above to create your first prescription.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={formEditHref("prescription", row.id)}
                    className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {row.surname || row.firstNames
                          ? `${row.surname} ${row.firstNames}`.trim()
                          : "Unnamed Patient"}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({row.hospitalNumber})
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Updated {formatDate(row.updatedAt)}
                      </span>
                    </div>
                    <Badge variant={row.status === "completed" ? "completed" : "draft"}>
                      {row.status === "completed" ? "Completed" : "Draft"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
