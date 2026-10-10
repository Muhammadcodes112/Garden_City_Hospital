import { requireUser } from "@/lib/authz";

// Deliberately separate from (staff)/layout.tsx's AppShell: a patient must
// never load the staff shell (nav links to patient records, messages,
// admin tools, etc.) — this is its own minimal shell.
export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">
          Garden City Specialist Hospital
        </span>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
