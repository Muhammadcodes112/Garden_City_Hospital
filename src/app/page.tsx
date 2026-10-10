import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getRole } from "@/lib/authz";

export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  redirect(getRole(session) === "patient" ? "/patient" : "/dashboard");
}
