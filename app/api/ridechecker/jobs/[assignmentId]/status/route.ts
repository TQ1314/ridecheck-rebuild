import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized, writeOrderEvent } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const VALID_TRANSITIONS: Record<string, string[]> = {
  assigned:          ["en_route", "escalated"],
  accepted:          ["en_route", "escalated"],
  en_route:          ["arrived", "escalated"],
  arrived:           ["inspection_started", "escalated"],
  inspection_started:["photos_uploading", "escalated"],
  photos_uploading:  ["report_pending", "escalated"],
  report_pending:    ["escalated"],
  in_progress:       ["inspection_started", "photos_uploading", "escalated"],
};

const STATUS_TIMESTAMP_COL: Record<string, string> = {
  en_route:           "en_route_at",
  arrived:            "arrived_at",
  inspection_started: "inspection_started_at",
  photos_uploading:   "photos_uploading_at",
  report_pending:     "report_pending_at",
  escalated:          "escalated_at",
};

const ORDER_STATUS_SYNC: Record<string, string> = {
  en_route:           "en_route",
  arrived:            "arrived",
  inspection_started: "in_progress",
  escalated:          "escalated",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  const result = await requireRole(["ridechecker_active", "owner"]);
  if (!isAuthorized(result)) return result.error;

  const { assignmentId } = params;
  const body = await req.json().catch(() => ({}));
  const { new_status, notes } = body as { new_status?: string; notes?: string };

  if (!new_status) {
    return NextResponse.json({ error: "new_status is required" }, { status: 400 });
  }

  const { data: assignment, error: fetchErr } = await supabaseAdmin
    .from("ridechecker_job_assignments")
    .select("id, order_id, ridechecker_id, status")
    .eq("id", assignmentId)
    .maybeSingle();

  if (fetchErr || !assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  // RideCheckers can only update their own assignments; owners can update any
  if (result.actor.role !== "owner" && assignment.ridechecker_id !== result.actor.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = VALID_TRANSITIONS[assignment.status] ?? [];
  if (!allowed.includes(new_status)) {
    return NextResponse.json(
      { error: `Cannot transition from '${assignment.status}' to '${new_status}'` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const tsCol = STATUS_TIMESTAMP_COL[new_status];

  const updatePayload: Record<string, unknown> = {
    status: new_status,
    last_status_update_at: now,
    ...(tsCol ? { [tsCol]: now } : {}),
    ...(new_status === "escalated" && notes ? { escalation_notes: notes } : {}),
  };

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("ridechecker_job_assignments")
    .update(updatePayload)
    .eq("id", assignmentId)
    .select("id, status, last_status_update_at")
    .single();

  if (updateErr) {
    console.error("[status PATCH error]", updateErr);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }

  // Log status change
  await supabaseAdmin.from("ridechecker_job_status_log").insert({
    assignment_id: assignmentId,
    order_id: assignment.order_id,
    ridechecker_id: assignment.ridechecker_id,
    old_status: assignment.status,
    new_status,
    notes: notes ?? null,
  });

  // Sync order assignment_status for key transitions
  if (ORDER_STATUS_SYNC[new_status]) {
    await supabaseAdmin
      .from("orders")
      .update({ assignment_status: ORDER_STATUS_SYNC[new_status] })
      .eq("id", assignment.order_id);
  }

  // Order event log
  await writeOrderEvent({
    orderId: assignment.order_id,
    eventType: "ridechecker_status_update",
    actorId: result.actor.userId,
    actorEmail: result.actor.email,
    details: { old_status: assignment.status, new_status, notes: notes ?? null },
    isInternal: true,
  });

  return NextResponse.json({ assignment: updated });
}
