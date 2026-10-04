import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { canProceedWithRideCheck } from "@/lib/payment/payment-gate";
import { z } from "zod";
import { facebookAppointmentError } from "@/lib/seller-contact/facebook-self-arrange";

const assignSchema = z.object({
  assigned_ops_id: z.string().uuid().optional(),
  inspector_id: z.string().uuid().optional(),
});

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
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
    let paymentGateOrder: { payment_status: string | null; payment_required: boolean | null; payment_override_approved: boolean | null } | null = null;

    if (parsed.data.assigned_ops_id) {
      updatePayload.assigned_ops_id = parsed.data.assigned_ops_id;
      eventDetails.assigned_ops_id = parsed.data.assigned_ops_id;
    }

    if (parsed.data.inspector_id) {
      const { data: order, error: paymentLookupError } = await supabaseAdmin
        .from("orders")
        .select("payment_status, payment_required, payment_override_approved, booking_type, listing_url, platform_source, seller_contact_status, seller_available_date, seller_available_time, seller_inspection_address")
        .eq("id", params.orderId)
        .maybeSingle();
      if (paymentLookupError) {
        console.error("[order assignment payment gate]", paymentLookupError);
        return NextResponse.json({ error: "Could not verify payment before inspector assignment" }, { status: 500 });
      }
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      if (!canProceedWithRideCheck(order)) {
        return NextResponse.json({ error: "Payment is required before assigning an inspector." }, { status: 402 });
      }
      const appointmentError = facebookAppointmentError(order);
      if (appointmentError) {
        return NextResponse.json({ error: appointmentError }, { status: 409 });
      }
      paymentGateOrder = order;
      updatePayload.assigned_inspector_id = parsed.data.inspector_id;
      updatePayload.assigned_at = new Date().toISOString();
      eventDetails.inspector_id = parsed.data.inspector_id;
    }

    let updateQuery = supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", params.orderId);
    if (parsed.data.inspector_id) {
      // Fail closed if payment state changes after authorization is checked.
      if (paymentGateOrder?.payment_required === false) {
        updateQuery = updateQuery.eq("payment_required", false);
      } else if (paymentGateOrder?.payment_status === "override_approved" &&
        paymentGateOrder.payment_override_approved === true) {
        updateQuery = updateQuery.eq("payment_status", "override_approved").eq("payment_override_approved", true);
      } else {
        updateQuery = updateQuery.eq("payment_status", paymentGateOrder!.payment_status);
      }
    }
    const { data: updatedRows, error } = await updateQuery.select("id");

    if (error) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
    if (parsed.data.inspector_id && !updatedRows?.length) {
      return NextResponse.json({ error: "Payment status changed before assignment; refresh and try again." }, { status: 409 });
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
