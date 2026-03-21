import { redirect } from "next/navigation";
import { getActor } from "@/lib/rbac";
import { AppShell } from "@/components/layout/AppShell";

const ALLOWED_ROLES = ["owner", "admin", "operations", "operations_lead", "ops"];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getActor();

  if (!actor) {
    redirect("/auth/login?error=login_required");
  }

  if (!ALLOWED_ROLES.includes(actor.role)) {
    redirect("/");
  }

  return <AppShell>{children}</AppShell>;
}
