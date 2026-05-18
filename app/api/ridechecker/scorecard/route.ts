import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTier, getNextTier, getPrevTierThreshold } from "@/lib/ridechecker/scorecard";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const result = await requireRole(["ridechecker_active", "ridechecker", "owner", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const rcId = result.actor.userId;

  const [profileRes, eventsRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("ridechecker_score, ridechecker_jobs_completed, ridechecker_on_time_pct, last_score_updated_at")
      .eq("id", rcId)
      .maybeSingle(),
    supabaseAdmin
      .from("ridechecker_score_events")
      .select("id, event_type, points, reason, assignment_id, order_id, created_at")
      .eq("ridechecker_id", rcId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const score = profileRes.data?.ridechecker_score ?? 0;
  const tier = getTier(score);
  const nextTier = getNextTier(score);
  const prevThreshold = getPrevTierThreshold(score);

  return NextResponse.json({
    score,
    tier,
    prevThreshold,
    nextTier,
    events: eventsRes.data ?? [],
    stats: {
      jobsCompleted: profileRes.data?.ridechecker_jobs_completed ?? 0,
      onTimePct: profileRes.data?.ridechecker_on_time_pct ?? 0,
      lastUpdated: profileRes.data?.last_score_updated_at ?? null,
    },
  });
}
