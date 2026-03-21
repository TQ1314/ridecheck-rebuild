import { redirect } from "next/navigation";
import { getActor } from "@/lib/rbac";

const ALLOWED_ROLES = ["ridechecker", "ridechecker_active", "owner"];

export default async function RideCheckerLayout({
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

  return <>{children}</>;
}
