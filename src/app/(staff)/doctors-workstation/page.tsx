import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Stethoscope, Pill, FlaskConical, FileText, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const WORKSTATION_FORMS = [
  {
    href: "/prescription",
    label: "Prescription Form",
    description: "Write and manage patient drug prescriptions.",
    icon: Pill,
  },
  {
    href: "/lab",
    label: "Laboratory Form",
    description: "Request laboratory tests and review results.",
    icon: FlaskConical,
  },
  {
    href: "/medical-report",
    label: "Medical Report",
    description: "Prepare official medical reports for patients.",
    icon: FileText,
  },
] as const;

export default function DoctorsWorkstationPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Stethoscope className="h-5 w-5 text-brand-green" /> Doctors Workstation
        </h1>
        <p className="text-sm text-muted-foreground">
          Select the form you'd like to work on.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {WORKSTATION_FORMS.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition-colors hover:border-brand-green hover:bg-muted/40">
              <CardContent className="flex items-start gap-3 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-green/10 text-brand-green">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
