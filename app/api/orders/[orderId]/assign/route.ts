import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

const assignSchema = z.object({
  assigned_ops_id: z.string().uuid().optional(),
  inspector_id: z.string().uuid().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    const eventDetails: Record<string, any> = {};

    if (parsed.data.assigned_ops_id) {
      updatePayload.assigned_ops_id = parsed.data.assigned_ops_id;
      eventDetails.assigned_ops_id = parsed.data.assigned_ops_id;
    }

    if (parsed.data.inspector_id) {
      updatePayload.assigned_inspector_id = parsed.data.inspector_id;
      updatePayload.assigned_at = new Date().toISOString();
      eventDetails.inspector_id = parsed.data.inspector_id;
    }

    const { error } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", params.orderId);

    if (error) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    await Promise.all([
      supabaseAdmin.from("activity_log").insert({
        user_id: actor.userId,
        order_id: params.orderId,
        action: "order_assigned",
        details: eventDetails,
      }),
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "assignment_changed",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: eventDetails,
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.assigned",
        resourceId: params.orderId,
        newValue: eventDetails,
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
