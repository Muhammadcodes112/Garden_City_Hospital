import { requireSuperAdmin } from "@/lib/session";
import { TrashView } from "@/components/records/trash-view";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  await requireSuperAdmin();

  return <TrashView />;
}
