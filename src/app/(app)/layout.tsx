import { requireAdmin } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <AppShell
      userName={session.user.name ?? session.user.email}
      userEmail={session.user.email}
    >
      {children}
    </AppShell>
  );
}
