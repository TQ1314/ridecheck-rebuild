import { redirect } from "next/navigation";
import { getActor } from "@/lib/rbac";
import { AppShell } from "@/components/layout/AppShell";

export default async function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getActor();

  if (!actor) {
    redirect("/auth/login?error=login_required");
  }

  return <AppShell>{children}</AppShell>;
}
