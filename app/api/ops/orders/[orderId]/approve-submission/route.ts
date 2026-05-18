import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scoreSubmission } from "@/lib/ridechecker/scoring";
import { getPayoutAmount } from "@/lib/ridechecker/payouts";
import { emitScoreEvents } from "@/lib/ridechecker/scorecard";
import type { ScoreEventType } from "@/lib/ridechecker/scorecard";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .select("*")
      .eq("order_id", params.orderId)
      .eq("status", "submitted")
      .maybeSingle();

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: "No submitted assignment found for this order" }, { status: 404 });
    }

    const { data: submission, error: subError } = await supabaseAdmin
      .from("ridechecker_raw_submissions")
      .select("*")
      .eq("order_id", params.orderId)
      .maybeSingle();

    if (subError || !submission) {
      return NextResponse.json({ error: "No submission found for scoring" }, { status: 404 });
    }

    const score = scoreSubmission({
      submission,
      scheduledEnd: assignment.scheduled_end,
    });

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("package")
      .eq("id", params.orderId)
      .single();

    const payout_amount = getPayoutAmount(order?.package || "standard");
    const now = new Date().toISOString();

    const { error: updateAssignmentError } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .update({
        status: "approved",
        approved_at: now,
        job_score: score.total,
        payout_amount,
        payout_status: "pending",
      })
      .eq("id", assignment.id);

    if (updateAssignmentError) {
      return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("ridechecker_jobs_completed, ridechecker_quality_score, ridechecker_rating")
      .eq("id", assignment.ridechecker_id)
      .single();

    if (profile) {
      const prevCompleted = profile.ridechecker_jobs_completed || 0;
      const prevQuality = profile.ridechecker_quality_score || 0;
      const newCompleted = prevCompleted + 1;
      const newQuality = Math.round(((prevQuality * prevCompleted + score.total) / newCompleted) * 100) / 100;

      let newRating = profile.ridechecker_rating || "bronze";
      if (newQuality >= 90) newRating = "gold";
      else if (newQuality >= 75) newRating = "silver";
      else newRating = "bronze";

      await supabaseAdmin
        .from("profiles")
        .update({
          ridechecker_jobs_completed: newCompleted,
          ridechecker_quality_score: newQuality,
          ridechecker_rating: newRating,
        })
        .eq("id", assignment.ridechecker_id);
    }

    await supabaseAdmin
      .from("ridechecker_earnings")
      .insert({
        ridechecker_id: assignment.ridechecker_id,
        order_id: params.orderId,
        package: order?.package || "standard",
        amount: payout_amount,
        status: "pending",
      });

    await Promise.all([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "submission_approved",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: { score: score.total, payout_amount },
        isInternal: true,
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.submission_approved",
        resourceId: params.orderId,
        newValue: { score: score.total, payout_amount, ridechecker_id: assignment.ridechecker_id },
      }),
    ]);

    // Stage 2 scoring — quality events after ops review
    const stage2: ScoreEventType[] = ["report_approved", "no_revision_needed"];
    // arrived_on_time = timeliness score >= 18 (submitted on time or up to 2 hrs late)
    // late_arrival    = timeliness score <= 8  (submitted 6+ hrs after window)
    if (score.timelinessScore >= 18) {
      stage2.push("arrived_on_time");
    } else if (score.timelinessScore <= 8) {
      stage2.push("late_arrival");
    }

    emitScoreEvents(
      stage2.map((eventType) => ({
        ridecheckerId: assignment.ridechecker_id,
        assignmentId: assignment.id,
        orderId: params.orderId,
        eventType,
      }))
    ).catch(() => {});

    return NextResponse.json({ success: true, score: score.total, payout_amount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
