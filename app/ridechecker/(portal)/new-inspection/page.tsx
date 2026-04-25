// app/ridechecker/(portal)/new-inspection/page.tsx
// Server component — gates access behind:
//   1. role === 'ridechecker_active' (enforced by portal layout)
//   2. training_sip4_completed === true
// If training not done → redirect to /ridechecker/training with a message.
import { redirect } from "next/navigation";
import { getActor } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function NewInspectionPage() {
  const actor = await getActor();

  if (!actor) {
    redirect("/auth/login?redirect=/ridechecker/new-inspection");
  }

  // Non-active ridecheckers are blocked by the portal layout already,
  // but we add an extra explicit check here for clarity and security.
  if (actor.role !== "ridechecker_active" && actor.role !== "owner") {
    redirect("/ridechecker/dashboard");
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("training_sip4_completed")
    .eq("id", actor.userId)
    .maybeSingle();

  // Owners bypass training gate (for testing)
  if (actor.role !== "owner" && !profile?.training_sip4_completed) {
    redirect("/ridechecker/training?gate=inspection");
  }

  // ── Placeholder — replace with real form when available ──────
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-new-inspection-title">
            New Vehicle Assessment
          </h1>
          <p className="text-muted-foreground mt-1">
            Certification verified. Assessment form coming soon.
          </p>
        </div>
        <div className="bg-muted rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">
            The full inspection submission form will be available here.
            Your certification is confirmed — this page is reserved for the assessment workflow.
          </p>
        </div>
      </div>
    </div>
  );
}
