import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  reason: z.string().min(5, "A reason of at least 5 characters is required."),
  confirmed: z.literal(true, {
    errorMap: () => ({ message: "You must confirm before approving an override." }),
  }),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations_lead", "ops_lead", "admin", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const { reason } = parsed.data;

    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status, payment_override_approved")
      .eq("id", params.orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.payment_override_approved) {
      return NextResponse.json(
        { error: "Payment override is already approved for this order." },
        { status: 409 }
      );
    }

    if (order.payment_status === "paid" || order.payment_status === "paid_manual_verified") {
      return NextResponse.json(
        { error: "Order is already paid — no override needed." },
        { status: 409 }
      );
    }

    const previousStatus = order.payment_status;
    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_override_approved: true,
        payment_status: "override_approved",
        payment_override_reason: reason,
        payment_override_by: actor.userId,
        payment_override_at: now,
        updated_at: now,
      })
      .eq("id", params.orderId);

    if (updateError) {
      console.error("[payment-override] update error", updateError);
      return NextResponse.json({ error: "Failed to approve override" }, { status: 500 });
    }

    await Promise.all([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "payment_override_approved",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: {
          reason,
          previous_payment_status: previousStatus,
          new_payment_status: "override_approved",
        },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.payment_override_approved",
        resourceId: params.orderId,
        newValue: {
          reason,
          previous_payment_status: previousStatus,
          new_payment_status: "override_approved",
          overridden_by: actor.userId,
          overridden_at: now,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
