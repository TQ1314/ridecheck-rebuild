import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum([
    "submitted",
    "payment_requested",
    "payment_received",
    "seller_contacted",
    "seller_confirmed",
    "inspection_scheduled",
    "inspection_in_progress",
    "report_drafting",
    "report_ready",
    "completed",
    "cancelled",
  ]),
  ops_notes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { data: currentOrder } = await supabaseAdmin
      .from("orders")
      .select("status")
      .eq("id", params.orderId)
      .single();

    const oldStatus = currentOrder?.status || "unknown";

    const updatePayload: Record<string, any> = {
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.ops_notes) {
      updatePayload.ops_notes = parsed.data.ops_notes;
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
        action: "status_changed",
        details: { old_status: oldStatus, new_status: parsed.data.status },
      }),
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "status_changed",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: {
          old_status: oldStatus,
          new_status: parsed.data.status,
          ...(parsed.data.ops_notes ? { notes: parsed.data.ops_notes } : {}),
        },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.status_changed",
        resourceId: params.orderId,
        oldValue: { status: oldStatus },
        newValue: { status: parsed.data.status },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
