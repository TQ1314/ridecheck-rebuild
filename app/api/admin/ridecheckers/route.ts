import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { nanoid } from "nanoid";
import {
  ridecheckerApprovedHtml,
  ridecheckerRejectedHtml,
  ridecheckerStageUpdateHtml,
} from "@/lib/email/templates/ridechecker-approval";

export const dynamic = "force-dynamic";

// Stages that indicate the candidate is in the active pipeline (not yet approved or rejected)
const PIPELINE_STAGES = [
  "applied",
  "under_review",
  "docs_requested",
  "docs_received",
  "background_pending",
  "background_clear",
  "reference_pending",
  "assessment_pending",
  "ready_for_approval",
];

const ALL_STAGES = [
  ...PIPELINE_STAGES,
  "approved",
  "active",
  "rejected",
  "suspended",
];

// Stages that send a notification email to the candidate
const NOTIFY_STAGES = new Set([
  "under_review",
  "docs_requested",
  "docs_received",
  "background_pending",
  "background_clear",
  "reference_pending",
  "assessment_pending",
  "ready_for_approval",
]);

const PROFILE_FIELDS = `
  id, full_name, email, phone, role, is_active,
  service_area, experience, created_at,
  approved_at, approved_by, rejected_at, rejection_reason,
  rating, referral_code,
  workflow_stage, documents_complete, background_check_status,
  references_status, assessment_score, reviewer_notes,
  invite_sent_at, invite_accepted_at, suspended_at,
  ridechecker_rating, ridechecker_jobs_completed, ridechecker_quality_score
`.replace(/\n\s+/g, " ").trim();

// ─────────────────────────────────────────────
// GET /api/admin/ridecheckers
// operations can view; ops_lead/owner can approve
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const result = await requireRole(["owner", "operations_lead", "operations"]);
  if (!isAuthorized(result)) return result.error;

  const { searchParams } = new URL(req.url);
  const stageGroup = searchParams.get("stage_group") || "all";

  let query = supabaseAdmin
    .from("profiles")
    .select(PROFILE_FIELDS)
    .in("role", ["ridechecker", "ridechecker_active"])
    .order("created_at", { ascending: false });

  switch (stageGroup) {
    case "pipeline":
      query = query.in("workflow_stage", PIPELINE_STAGES);
      break;
    case "ready":
      query = query.eq("workflow_stage", "ready_for_approval");
      break;
    case "active":
      query = query.in("workflow_stage", ["approved", "active"]);
      break;
    case "closed":
      query = query.in("workflow_stage", ["rejected", "suspended"]);
      break;
    // "all" — no additional filter
  }

  const { data, error } = await query;

  if (error) {
    console.error("[admin/ridecheckers GET]", error.message);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  const rows = data || [];

  const stats = {
    total: rows.length,
    pipeline: rows.filter((r: any) => PIPELINE_STAGES.includes(r.workflow_stage)).length,
    ready:    rows.filter((r: any) => r.workflow_stage === "ready_for_approval").length,
    active:   rows.filter((r: any) => ["approved", "active"].includes(r.workflow_stage)).length,
    closed:   rows.filter((r: any) => ["rejected", "suspended"].includes(r.workflow_stage)).length,
  };

  return NextResponse.json({ ridecheckers: rows, stats });
}

// ─────────────────────────────────────────────
// PATCH /api/admin/ridecheckers
// All writes restricted to operations_lead / owner
// ─────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const result = await requireRole(["owner", "operations_lead"]);
  if (!isAuthorized(result)) return result.error;
  const { actor } = result;

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { userId, action } = body;
  if (!userId || !action) {
    return NextResponse.json({ error: "userId and action are required" }, { status: 400 });
  }

  // Fetch current candidate state
  const { data: target, error: fetchError } = await supabaseAdmin
    .from("profiles")
    .select(`id, full_name, email, role, is_active,
             workflow_stage, documents_complete, assessment_score,
             background_check_status, references_status`)
    .eq("id", userId)
    .maybeSingle();

  if (fetchError || !target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!["ridechecker", "ridechecker_active"].includes(target.role)) {
    return NextResponse.json({ error: "Target is not a RideChecker" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const now = new Date().toISOString();

  // ── ACTION: approve ─────────────────────────────────────────
  if (action === "approve") {
    // Hard prerequisites
    if (target.workflow_stage !== "ready_for_approval") {
      return NextResponse.json(
        { error: "Candidate must be at the ready_for_approval stage before approval" },
        { status: 422 }
      );
    }
    if (!target.documents_complete) {
      return NextResponse.json(
        { error: "Documents must be marked complete before approval" },
        { status: 422 }
      );
    }
    if (target.assessment_score == null) {
      return NextResponse.json(
        { error: "Assessment score must be recorded before approval" },
        { status: 422 }
      );
    }

    const inviteToken = nanoid(40);
    const setupUrl = `${appUrl}/ridechecker/onboarding?token=${inviteToken}`;

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        role:           "ridechecker_active",   // grant dashboard access
        is_active:      true,
        workflow_stage: "approved",
        approved_at:    now,
        approved_by:    actor.userId,
        invite_token:   inviteToken,
        invite_sent_at: now,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[ridechecker approve]", updateError.message);
      return NextResponse.json({ error: "Approval failed" }, { status: 500 });
    }

    await insertStageHistory({
      ridecheckerId:  userId,
      fromStage:      target.workflow_stage,
      toStage:        "approved",
      changedBy:      actor.userId,
      changedByEmail: actor.email,
      changedByRole:  actor.role,
      notes:          body.notes || null,
    });

    await writeAuditLog({
      actorId:    actor.userId,
      actorEmail: actor.email,
      actorRole:  actor.role,
      action:     "ridechecker.approve",
      resourceId: userId,
      oldValue:   { role: target.role, workflow_stage: target.workflow_stage },
      newValue:   { role: "ridechecker_active", workflow_stage: "approved" },
    });

    if (target.email) {
      await sendEmail({
        to:      target.email,
        subject: "Congratulations — You've Been Approved as a RideChecker!",
        html:    ridecheckerApprovedHtml({
          name:     target.full_name || "RideChecker",
          setupUrl,
        }),
      });
    }

    return NextResponse.json({ success: true, action: "approved" });
  }

  // ── ACTION: reject ─────────────────────────────────────────
  if (action === "reject") {
    const reason = typeof body.reason === "string" ? body.reason.trim() : null;

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        is_active:        false,
        workflow_stage:   "rejected",
        rejected_at:      now,
        rejection_reason: reason,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[ridechecker reject]", updateError.message);
      return NextResponse.json({ error: "Rejection failed" }, { status: 500 });
    }

    await insertStageHistory({
      ridecheckerId:  userId,
      fromStage:      target.workflow_stage,
      toStage:        "rejected",
      changedBy:      actor.userId,
      changedByEmail: actor.email,
      changedByRole:  actor.role,
      notes:          reason,
    });

    await writeAuditLog({
      actorId:    actor.userId,
      actorEmail: actor.email,
      actorRole:  actor.role,
      action:     "ridechecker.reject",
      resourceId: userId,
      oldValue:   { workflow_stage: target.workflow_stage },
      newValue:   { workflow_stage: "rejected", rejection_reason: reason },
    });

    if (target.email) {
      await sendEmail({
        to:      target.email,
        subject: "RideChecker Application Update",
        html:    ridecheckerRejectedHtml({
          name:   target.full_name || "Applicant",
          reason: reason || undefined,
        }),
      });
    }

    return NextResponse.json({ success: true, action: "rejected" });
  }

  // ── ACTION: suspend ────────────────────────────────────────
  if (action === "suspend") {
    if (target.role !== "ridechecker_active") {
      return NextResponse.json({ error: "Only active RideCheckers can be suspended" }, { status: 400 });
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : null;

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        role:           "ridechecker",    // revoke dashboard access
        is_active:      false,
        workflow_stage: "suspended",
        suspended_at:   now,
        rejection_reason: reason,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[ridechecker suspend]", updateError.message);
      return NextResponse.json({ error: "Suspension failed" }, { status: 500 });
    }

    await insertStageHistory({
      ridecheckerId:  userId,
      fromStage:      target.workflow_stage,
      toStage:        "suspended",
      changedBy:      actor.userId,
      changedByEmail: actor.email,
      changedByRole:  actor.role,
      notes:          reason,
    });

    await writeAuditLog({
      actorId:    actor.userId,
      actorEmail: actor.email,
      actorRole:  actor.role,
      action:     "ridechecker.suspend",
      resourceId: userId,
      oldValue:   { role: "ridechecker_active", workflow_stage: target.workflow_stage },
      newValue:   { role: "ridechecker", workflow_stage: "suspended" },
    });

    return NextResponse.json({ success: true, action: "suspended" });
  }

  // ── ACTION: update_stage ───────────────────────────────────
  if (action === "update_stage") {
    const { toStage, notes } = body;
    if (!toStage || !ALL_STAGES.includes(toStage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    // Funnel terminal stages through their proper actions
    if (toStage === "approved") {
      return NextResponse.json(
        { error: "Use the approve action for final approval" },
        { status: 400 }
      );
    }
    if (toStage === "rejected") {
      return NextResponse.json(
        { error: "Use the reject action for rejection" },
        { status: 400 }
      );
    }
    if (toStage === "suspended") {
      return NextResponse.json(
        { error: "Use the suspend action for suspension" },
        { status: 400 }
      );
    }

    const profileUpdate: Record<string, any> = { workflow_stage: toStage };

    // If reinstating a suspended ridechecker back into pipeline
    if (target.workflow_stage === "suspended" && PIPELINE_STAGES.includes(toStage)) {
      profileUpdate.is_active = true;
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);

    if (updateError) {
      console.error("[ridechecker update_stage]", updateError.message);
      return NextResponse.json({ error: "Stage update failed" }, { status: 500 });
    }

    await insertStageHistory({
      ridecheckerId:  userId,
      fromStage:      target.workflow_stage,
      toStage,
      changedBy:      actor.userId,
      changedByEmail: actor.email,
      changedByRole:  actor.role,
      notes:          typeof notes === "string" ? notes.trim() : null,
    });

    await writeAuditLog({
      actorId:    actor.userId,
      actorEmail: actor.email,
      actorRole:  actor.role,
      action:     "ridechecker.stage_update",
      resourceId: userId,
      oldValue:   { workflow_stage: target.workflow_stage },
      newValue:   { workflow_stage: toStage },
    });

    // Optionally notify candidate of stage change
    if (NOTIFY_STAGES.has(toStage) && target.email) {
      await sendEmail({
        to:      target.email,
        subject: "RideChecker Application — Status Update",
        html:    ridecheckerStageUpdateHtml({
          name:    target.full_name || "Applicant",
          toStage,
          notes:   typeof notes === "string" ? notes : undefined,
        }),
      }).catch(() => {}); // non-fatal
    }

    return NextResponse.json({ success: true, action: "stage_updated", toStage });
  }

  // ── ACTION: update_fields ──────────────────────────────────
  if (action === "update_fields") {
    const allowed = [
      "documents_complete",
      "background_check_status",
      "references_status",
      "assessment_score",
      "reviewer_notes",
    ];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (key in body) {
        updates[key] = body[key];
      }
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (updateError) {
      console.error("[ridechecker update_fields]", updateError.message);
      return NextResponse.json({ error: "Field update failed" }, { status: 500 });
    }

    await writeAuditLog({
      actorId:    actor.userId,
      actorEmail: actor.email,
      actorRole:  actor.role,
      action:     "ridechecker.update_fields",
      resourceId: userId,
      newValue:   updates,
    });

    return NextResponse.json({ success: true, action: "fields_updated", updates });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// ─────────────────────────────────────────────
// Internal helper — insert a stage history row
// ─────────────────────────────────────────────
async function insertStageHistory({
  ridecheckerId,
  fromStage,
  toStage,
  changedBy,
  changedByEmail,
  changedByRole,
  notes,
}: {
  ridecheckerId:  string;
  fromStage:      string | null;
  toStage:        string;
  changedBy:      string;
  changedByEmail: string;
  changedByRole:  string;
  notes:          string | null;
}) {
  const { error } = await supabaseAdmin
    .from("ridechecker_stage_history")
    .insert({
      ridechecker_id:   ridecheckerId,
      from_stage:       fromStage,
      to_stage:         toStage,
      changed_by:       changedBy,
      changed_by_email: changedByEmail,
      changed_by_role:  changedByRole,
      notes,
    });
  if (error) {
    console.error("[stage history insert]", error.message);
  }
}
