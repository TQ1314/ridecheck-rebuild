import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ── Event catalogue ───────────────────────────────────────────────────────────
export type ScoreEventType =
  | "accepted_job"
  | "submitted_inspection"
  | "all_required_photos"
  | "no_missing_steps"
  | "report_approved"
  | "arrived_on_time"
  | "no_revision_needed"
  | "late_arrival"
  | "revision_required"
  | "revision_corrected"
  | "no_show"
  | "declined_assignment"
  | "seller_cancellation"
  | "seller_refusal_documented"
  | "vehicle_not_present"
  | "unsafe_flag_valid";

export const SCORE_POINTS: Record<ScoreEventType, number> = {
  // Stage 1 — on submission
  accepted_job:              5,
  submitted_inspection:     20,
  all_required_photos:      15,
  no_missing_steps:         10,
  // Stage 2 — on ops approval
  report_approved:          25,
  arrived_on_time:          10,
  no_revision_needed:       10,
  // Negative
  late_arrival:            -10,
  revision_required:        -5,
  no_show:                 -50,
  declined_assignment:      -5,
  // Neutral / documented — no penalty
  revision_corrected:        8,
  seller_cancellation:       0,
  seller_refusal_documented: 0,
  vehicle_not_present:       0,
  unsafe_flag_valid:         5,
};

export const SCORE_REASONS: Record<ScoreEventType, string> = {
  accepted_job:              "Accepted a job offer",
  submitted_inspection:      "Submitted complete inspection",
  all_required_photos:       "All required photos uploaded",
  no_missing_steps:          "No missing checklist steps",
  report_approved:           "Report approved by RideCheck Ops",
  arrived_on_time:           "Arrived and submitted on time",
  no_revision_needed:        "Report accepted on first review",
  late_arrival:              "Late submission — outside scheduled window",
  revision_required:         "Revision requested by Ops — use this as a learning moment",
  revision_corrected:        "Correction submitted after revision",
  no_show:                   "No-show — failed to appear for inspection",
  declined_assignment:       "Declined an assignment offer",
  seller_cancellation:       "Seller cancelled — not the RideChecker's fault",
  seller_refusal_documented: "Seller refused access — properly documented",
  vehicle_not_present:       "Vehicle not present — properly documented",
  unsafe_flag_valid:         "Valid safety concern flagged and documented",
};

// ── Tier system ───────────────────────────────────────────────────────────────
export type RideCheckerTier = "Rookie" | "Trusted" | "Elite" | "Master RideChecker";

const TIER_THRESHOLDS: [number, RideCheckerTier][] = [
  [700, "Master RideChecker"],
  [300, "Elite"],
  [100, "Trusted"],
  [0,   "Rookie"],
];

export function getTier(score: number): RideCheckerTier {
  for (const [threshold, tier] of TIER_THRESHOLDS) {
    if (score >= threshold) return tier;
  }
  return "Rookie";
}

export function getNextTier(score: number): { tier: RideCheckerTier; threshold: number; pointsNeeded: number } | null {
  const ascending: [number, RideCheckerTier][] = [[100, "Trusted"], [300, "Elite"], [700, "Master RideChecker"]];
  for (const [threshold, tier] of ascending) {
    if (score < threshold) return { tier, threshold, pointsNeeded: threshold - score };
  }
  return null;
}

export function getPrevTierThreshold(score: number): number {
  if (score >= 700) return 700;
  if (score >= 300) return 300;
  if (score >= 100) return 100;
  return 0;
}

// ── Core emitter ──────────────────────────────────────────────────────────────
export interface ScoreEventInput {
  ridecheckerId: string;
  assignmentId?: string | null;
  orderId?: string | null;
  eventType: ScoreEventType;
  customReason?: string;
}

export interface ScoreEventResult {
  success: boolean;
  skipped?: boolean;
  newScore?: number;
  error?: string;
}

export async function emitScoreEvent(input: ScoreEventInput): Promise<ScoreEventResult> {
  const { ridecheckerId, assignmentId, orderId, eventType, customReason } = input;
  const points = SCORE_POINTS[eventType];
  const reason = customReason ?? SCORE_REASONS[eventType];

  const { error: insertErr } = await supabaseAdmin
    .from("ridechecker_score_events")
    .insert({
      ridechecker_id: ridecheckerId,
      assignment_id: assignmentId ?? null,
      order_id: orderId ?? null,
      event_type: eventType,
      points,
      reason,
    });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return { success: true, skipped: true };
    }
    console.error("[scorecard] emitScoreEvent error", eventType, insertErr.message);
    return { success: false, error: insertErr.message };
  }

  // Recalculate total from source of truth (immutable log)
  const { data: agg } = await supabaseAdmin
    .from("ridechecker_score_events")
    .select("points")
    .eq("ridechecker_id", ridecheckerId);

  const newScore = Math.max(0, (agg ?? []).reduce((sum, r) => sum + (r.points as number), 0));

  await supabaseAdmin
    .from("profiles")
    .update({
      ridechecker_score: newScore,
      last_score_updated_at: new Date().toISOString(),
    })
    .eq("id", ridecheckerId);

  return { success: true, newScore };
}

// ── Batch emitter (Stage 1 or Stage 2) ───────────────────────────────────────
export async function emitScoreEvents(events: ScoreEventInput[]): Promise<void> {
  for (const ev of events) {
    await emitScoreEvent(ev).catch((err) =>
      console.error("[scorecard] batch event failed", ev.eventType, err)
    );
  }
}
