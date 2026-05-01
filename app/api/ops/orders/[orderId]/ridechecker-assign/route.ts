import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  ridechecker_id: z.string().uuid().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { ridechecker_id } = parsed.data;

    // Verify order exists
    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_id, vehicle_year, vehicle_make, vehicle_model, assignment_status, current_offer, base_pay, boost_amount")
      .eq("id", params.orderId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // If assigning a RideChecker, verify they exist and are active
    if (ridechecker_id) {
      const { data: rc, error: rcErr } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", ridechecker_id)
        .single();

      if (rcErr || !rc) {
        return NextResponse.json({ error: "RideChecker not found" }, { status: 404 });
      }
      if (!["ridechecker_active", "owner", "developer"].includes(rc.role)) {
        return NextResponse.json({ error: "User is not an active RideChecker" }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const newStatus = ridechecker_id ? "assigned" : "unassigned";

    // Update orders
    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        assigned_ridechecker_id: ridechecker_id,
        assignment_status: newStatus,
        updated_at: now,
      })
      .eq("id", params.orderId);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
    }

    // Expire any open broadcasts for this order
    if (ridechecker_id) {
      await supabaseAdmin
        .from("job_broadcasts")
        .update({ status: "expired", updated_at: now })
        .eq("order_id", params.orderId)
        .eq("status", "sent");
    }

    await Promise.allSettled([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: ridechecker_id ? "ridechecker_assigned" : "ridechecker_unassigned",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: { ridechecker_id: ridechecker_id ?? null },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: ridechecker_id ? "order.ridechecker_assigned" : "order.ridechecker_unassigned",
        resourceId: params.orderId,
        newValue: { ridechecker_id: ridechecker_id ?? null, assignment_status: newStatus },
      }),
    ]);

    return NextResponse.json({ success: true, assignment_status: newStatus });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
