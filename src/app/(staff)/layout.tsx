import { requireStaff } from "@/lib/authz";
import { AppShell } from "@/components/layout/app-shell";
import { MessagesPollProvider } from "@/hooks/use-messages-poll";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();

  return (
    <MessagesPollProvider>
      <AppShell
        userName={session.user.name ?? session.user.email}
        userEmail={session.user.email}
      >
        {children}
      </AppShell>
    </MessagesPollProvider>
  );
}
