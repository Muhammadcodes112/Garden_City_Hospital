import { requireUser } from "@/lib/authz";
import { PatientHeader } from "@/components/patient/patient-header";

// Deliberately separate from (staff)/layout.tsx's AppShell: a patient must
// never load the staff shell (nav links to patient records, messages,
// admin tools, etc.) — this is its own minimal top-nav shell.
export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PatientHeader
        userName={session.user.name ?? session.user.email}
        userEmail={session.user.email}
      />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
