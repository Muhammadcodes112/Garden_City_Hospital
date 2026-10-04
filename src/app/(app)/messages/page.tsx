import { requireAdmin } from "@/lib/session";
import { listPeople } from "@/lib/actions/messages";
import { MessagesShell } from "@/components/messages/messages-shell";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  await requireAdmin();
  const people = await listPeople();

  return <MessagesShell initialPeople={people} />;
}
