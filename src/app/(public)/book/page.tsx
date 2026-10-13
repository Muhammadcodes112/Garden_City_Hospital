import { Suspense } from "react";
import { PublicHeader } from "@/components/public/public-header";
import { BookingFlow } from "@/components/public/booking-flow";

export const metadata = {
  title: "Book an Appointment | Garden City Specialist Hospital",
  description:
    "Schedule your medical consultation with top specialists at Garden City Specialist Hospital, Kaduna. Real-time slot availability, instant SMS confirmation.",
};

export default function BookAppointmentPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />
      <main className="flex-1 py-4 sm:py-8">
        <Suspense
          fallback={
            <div className="mx-auto max-w-4xl p-8 text-center text-xs text-muted-foreground">
              Loading appointment booking...
            </div>
          }
        >
          <BookingFlow />
        </Suspense>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground bg-card">
        <p>© {new Date().getFullYear()} Garden City Specialist Hospital, Kaduna. All rights reserved.</p>
        <p className="mt-1 text-[11px]">The Pathway to High-Quality and Affordable Health Care</p>
      </footer>
    </div>
  );
}
