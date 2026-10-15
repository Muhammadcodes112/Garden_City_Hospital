import { requireStaff } from "@/lib/authz";
import { AppShell } from "@/components/layout/app-shell";
import { MessagesPollProvider } from "@/hooks/use-messages-poll";
import { getSavedSignatureUrl } from "@/lib/signature";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  const signatureUrl = await getSavedSignatureUrl(session.user.id);

  return (
    <MessagesPollProvider>
      <AppShell
        userName={session.user.name ?? session.user.email}
        userEmail={session.user.email}
        initialSignatureUrl={signatureUrl}
      >
        {children}
      </AppShell>
    </MessagesPollProvider>
  );
}
