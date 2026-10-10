import { requireSuperAdmin } from "@/lib/authz";
import { TrashView } from "@/components/records/trash-view";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  await requireSuperAdmin();

  return <TrashView />;
}
