import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_id, assigned_ridechecker_id, assignment_status")
      .eq("id", params.orderId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Cancel any open assignments
    await supabaseAdmin
      .from("ridechecker_job_assignments")
      .update({ status: "cancelled", updated_at: now })
      .eq("order_id", params.orderId)
      .in("status", ["awaiting_acceptance", "assigned", "accepted", "en_route", "arrived", "inspection_started", "photos_uploading", "report_pending", "escalated", "in_progress"]);

    // Reset order to unassigned
    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        assignment_status: "unassigned",
        assigned_ridechecker_id: null,
        updated_at: now,
      })
      .eq("id", params.orderId);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to cancel assignment" }, { status: 500 });
    }

    await Promise.allSettled([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "ridechecker_assignment_cancelled",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: {
          previous_ridechecker_id: order.assigned_ridechecker_id,
          previous_status: order.assignment_status,
        },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.ridechecker_assignment_cancelled",
        resourceId: params.orderId,
        newValue: { assignment_status: "unassigned", assigned_ridechecker_id: null },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
