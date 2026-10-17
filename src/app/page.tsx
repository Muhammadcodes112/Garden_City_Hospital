import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getRole } from "@/lib/authz";

export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const role = getRole(session);
  redirect(role === "patient" ? "/patient" : role === "cashier" ? "/cashier" : "/dashboard");
}
