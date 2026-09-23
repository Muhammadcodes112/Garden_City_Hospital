import { requireAdmin } from "@/lib/session";
import { db } from "@/db";
import { user } from "@/db/schema";
import { RecordsView } from "@/components/records/records-view";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const session = await requireAdmin();
  const isSuperAdmin = (session.user as { role?: string }).role === "super_admin";

  const adminUsers = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user);

  return (
    <RecordsView
      isSuperAdmin={isSuperAdmin}
      currentUserId={session.user.id}
      adminUsers={adminUsers}
    />
  );
}
