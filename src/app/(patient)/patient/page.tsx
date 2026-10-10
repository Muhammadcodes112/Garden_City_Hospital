import { requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function PatientHomePage() {
  const session = await requireUser();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Welcome, {session.user.name}
      </h1>
      <p className="text-sm text-muted-foreground">
        Your patient account is active. There&apos;s nothing to show here yet —
        this area will grow as patient-facing features are built.
      </p>
    </div>
  );
}
