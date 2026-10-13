import Link from "next/link";
import { Calendar, PlusCircle, ArrowRight, ShieldCheck, Stethoscope } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PatientHomePage() {
  const session = await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
          Welcome back, {session.user.name || "Patient"}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Manage your appointments and healthcare consultations at Garden City Specialist Hospital.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Book Appointment Card */}
        <Card className="rounded-2xl border-2 border-brand-green/30 bg-card p-6 space-y-4 shadow-xs hover:border-brand-green transition-colors">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green text-white shadow-xs">
            <PlusCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="font-black text-lg text-foreground">Book an Appointment</h2>
            <p className="text-xs text-muted-foreground">
              Select a doctor, pick a date & time, and schedule your consultation online in minutes.
            </p>
          </div>
          <Button asChild className="bg-brand-green hover:bg-brand-green/90 text-white font-bold text-xs gap-1.5 w-full">
            <Link href="/book">
              <span>Book Appointment</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </Card>

        {/* View Appointments Card */}
        <Card className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xs hover:border-brand-green/40 transition-colors">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xs">
            <Calendar className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="font-black text-lg text-foreground">My Appointments</h2>
            <p className="text-xs text-muted-foreground">
              Check your upcoming appointments, reschedule consultation times, or view previous visits.
            </p>
          </div>
          <Button asChild variant="outline" className="font-bold text-xs gap-1.5 w-full">
            <Link href="/patient/appointments">
              <span>View Consultations</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </Card>
      </div>

      {/* Hospital Care Callout */}
      <div className="rounded-2xl border border-border bg-slate-50 dark:bg-muted/30 p-5 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green mt-0.5">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-sm text-foreground">
            Garden City Specialist Hospital, Kaduna
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            For urgent medical emergencies, please call our direct hospital helpline at{" "}
            <strong className="text-foreground">+234 800 427 3362</strong> or visit the clinic reception directly.
          </p>
        </div>
      </div>
    </div>
  );
}
