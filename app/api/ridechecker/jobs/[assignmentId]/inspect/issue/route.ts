import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ISSUE_TYPES } from "@/lib/inspection/steps";
import { z } from "zod";

export const dynamic = "force-dynamic";

const issueSchema = z.object({
  issue_type: z.enum([
    "unsafe_location", "hostile_seller", "vehicle_not_present",
    "seller_refused_access", "vin_mismatch", "suspected_fraud",
    "weather_delay", "police_issue", "other",
  ]),
  note: z.string().min(1, "Please describe the issue"),
});

// HOLD statuses for assignments
const HOLD_STATUS: Record<string, string> = {
  unsafe_location:  "unsafe_hold",
  vin_mismatch:     "fraud_hold",
  suspected_fraud:  "fraud_hold",
  police_issue:     "unsafe_hold",
};

export async function POST(
  req: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  const result = await requireRole(["ridechecker_active", "owner", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const { assignmentId } = params;
  const body = await req.json().catch(() => ({}));
  const parsed = issueSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { issue_type, note } = parsed.data;

  // Verify assignment
  const { data: assignment } = await supabaseAdmin
    .from("ridechecker_job_assignments")
    .select("id, order_id, ridechecker_id, status")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  if (result.actor.role === "ridechecker_active" && assignment.ridechecker_id !== result.actor.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const holdStatus = HOLD_STATUS[issue_type] ?? null;
  const holdTriggered = !!holdStatus;
  const now = new Date().toISOString();

  // Create the issue record
  const { data: issue, error: issueErr } = await supabaseAdmin
    .from("ridecheck_inspection_issues")
    .insert({
      assignment_id: assignmentId,
      order_id: assignment.order_id,
      ridechecker_id: assignment.ridechecker_id,
      issue_type,
      note,
      hold_triggered: holdTriggered,
    })
    .select("id")
    .single();

  if (issueErr) {
    console.error("[inspect issue create]", issueErr);
    return NextResponse.json({ error: "Failed to create issue" }, { status: 500 });
  }

  // If this triggers a hold, update the assignment and order
  if (holdTriggered && holdStatus) {
    await supabaseAdmin
      .from("ridechecker_job_assignments")
      .update({
        status: holdStatus,
        last_status_update_at: now,
        escalation_notes: `[${issue_type.replace(/_/g, " ")}] ${note}`,
      })
      .eq("id", assignmentId);

    await supabaseAdmin
      .from("orders")
      .update({ assignment_status: "escalated" })
      .eq("id", assignment.order_id);
  }

  // Always log to status log
  try {
    await supabaseAdmin.from("ridechecker_job_status_log").insert({
      assignment_id: assignmentId,
      order_id: assignment.order_id,
      ridechecker_id: assignment.ridechecker_id,
      old_status: assignment.status,
      new_status: holdTriggered && holdStatus ? holdStatus : assignment.status,
      notes: `[ISSUE REPORTED] ${issue_type}: ${note}`,
    });
  } catch { }

  return NextResponse.json({
    success: true,
    issue_id: issue.id,
    hold_triggered: holdTriggered,
    hold_status: holdStatus,
  });
}
