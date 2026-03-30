import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PROFILE_FIELDS = `
  id, full_name, email, phone, role, is_active,
  service_area, experience, created_at,
  approved_at, approved_by, rejected_at, rejection_reason,
  rating, referral_code,
  workflow_stage, documents_complete, background_check_status,
  references_status, assessment_score, reviewer_notes,
  invite_sent_at, invite_accepted_at, suspended_at,
  ridechecker_rating, ridechecker_jobs_completed, ridechecker_quality_score,
  ridechecker_max_daily_jobs
`.replace(/\n\s+/g, " ").trim();

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const result = await requireRole(["owner", "operations_lead", "operations"]);
  if (!isAuthorized(result)) return result.error;

  const { userId } = params;

  const [profileResult, historyResult] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("id", userId)
      .in("role", ["ridechecker", "ridechecker_active"])
      .maybeSingle(),

    supabaseAdmin
      .from("ridechecker_stage_history")
      .select("id, from_stage, to_stage, changed_by_email, changed_by_role, notes, created_at")
      .eq("ridechecker_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (profileResult.error || !profileResult.data) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  return NextResponse.json({
    candidate: profileResult.data,
    stageHistory: historyResult.data || [],
  });
}
