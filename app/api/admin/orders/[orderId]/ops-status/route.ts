import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

const opsStatusSchema = z.object({
  ops_status: z.enum([
    "new", "seller_outreach", "seller_confirmed", "payment_pending",
    "payment_received", "inspector_assigned", "scheduled", "in_progress",
    "report_drafting", "report_review", "delivered", "completed",
    "on_hold", "cancelled",
  ]),
  ops_notes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = opsStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid ops_status" }, { status: 400 });
    }

    const { data: currentOrder } = await supabaseAdmin
      .from("orders")
      .select("ops_status")
      .eq("id", params.orderId)
      .single();

    const oldOpsStatus = currentOrder?.ops_status || "new";

    const updatePayload: Record<string, any> = {
      ops_status: parsed.data.ops_status,
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.ops_notes !== undefined) {
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
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "ops_status_changed",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: {
          old_ops_status: oldOpsStatus,
          new_ops_status: parsed.data.ops_status,
          ...(parsed.data.ops_notes ? { notes: parsed.data.ops_notes } : {}),
        },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.ops_status_changed",
        resourceType: "order",
        resourceId: params.orderId,
        oldValue: { ops_status: oldOpsStatus },
        newValue: { ops_status: parsed.data.ops_status },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
