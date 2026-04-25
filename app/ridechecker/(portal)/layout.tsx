import { redirect } from "next/navigation";
import { getActor } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

  // Verification gate — only for 'ridechecker' role (not ridechecker_active or owner)
  if (actor.role === "ridechecker") {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("verification_status")
      .eq("id", actor.userId)
      .maybeSingle();

    const vStatus = profile?.verification_status as string | null;

    if (vStatus === "pending_verification") {
      redirect("/ridechecker/verify");
    }
    if (vStatus === "submitted") {
      redirect("/ridechecker/verification-pending");
    }
    if (vStatus === "rejected") {
      redirect("/ridechecker/verify?status=rejected");
    }
    // null = legacy ridechecker accounts (old flow before verification was introduced)
    // fall through to dashboard which shows "pending approval" banner
  }

  return <>{children}</>;
}
