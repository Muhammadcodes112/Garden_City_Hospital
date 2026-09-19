import { listFormRecords } from "@/lib/form-records";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formNewHref } from "@/lib/routes";
import { Pill } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PrescriptionListPage() {
  const rows = await listFormRecords("prescription");

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Prescription editing is coming in the next step.
      </p>
      <Button asChild className="w-fit">
        <Link href={formNewHref("prescription")}>
          <Pill className="h-4 w-4" />
          New prescription
        </Link>
      </Button>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <Pill className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">No prescriptions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Saved prescriptions will show up here once you create them.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {row.surname} {row.firstNames}{" "}
                    <span className="text-muted-foreground">({row.hospitalNumber})</span>
                  </span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    {formatDate(row.updatedAt)}
                    <Badge variant={row.status === "completed" ? "completed" : "draft"}>
                      {row.status === "completed" ? "Completed" : "Draft"}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
