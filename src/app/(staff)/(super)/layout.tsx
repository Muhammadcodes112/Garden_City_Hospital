import { requireSuperAdmin } from "@/lib/authz";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return <>{children}</>;
}
