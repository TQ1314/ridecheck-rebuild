import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { getStripe } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status, stripe_session_id, payment_intent_id, buyer_email, customer_email")
      .eq("id", params.orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Already paid — nothing to sync
    if (order.payment_status === "paid") {
      return NextResponse.json({
        success: true,
        already_paid: true,
        message: "Order is already marked as paid.",
      });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    let stripePaid = false;
    let paymentIntentId: string | null = null;
    let checkedVia: string = "none";

    // 1. Try by stripe_session_id
    if (order.stripe_session_id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
        checkedVia = "session";
        if (session.payment_status === "paid") {
          stripePaid = true;
          paymentIntentId = typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null;
        }
        console.log("[Sync Payment] Stripe session retrieved", {
          orderId: params.orderId,
          sessionId: order.stripe_session_id,
          sessionPaymentStatus: session.payment_status,
        });
      } catch (stripeErr: any) {
        console.warn("[Sync Payment] Failed to retrieve session from Stripe", {
          orderId: params.orderId,
          sessionId: order.stripe_session_id,
          error: stripeErr.message,
        });
      }
    }

    // 2. Fallback: try by payment_intent_id
    if (!stripePaid && order.payment_intent_id) {
      try {
        const intent = await stripe.paymentIntents.retrieve(order.payment_intent_id);
        checkedVia = "payment_intent";
        if (intent.status === "succeeded") {
          stripePaid = true;
          paymentIntentId = intent.id;
        }
        console.log("[Sync Payment] Stripe payment intent retrieved", {
          orderId: params.orderId,
          intentId: order.payment_intent_id,
          intentStatus: intent.status,
        });
      } catch (piErr: any) {
        console.warn("[Sync Payment] Failed to retrieve payment intent from Stripe", {
          orderId: params.orderId,
          intentId: order.payment_intent_id,
          error: piErr.message,
        });
      }
    }

    if (!stripePaid) {
      console.log("[Sync Payment] Stripe confirms NOT paid", { orderId: params.orderId, checkedVia });
      return NextResponse.json({
        success: false,
        synced: false,
        message: "Stripe does not show this order as paid.",
        checked_via: checkedVia,
      });
    }

    // Stripe confirms paid — update the order
    const now = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      payment_status: "paid",
      paid_at: now,
      status: "payment_received",
      ops_status: "payment_received",
      updated_at: now,
    };

    if (paymentIntentId) {
      updatePayload.payment_intent_id = paymentIntentId;
    }

    // Backfill customer_id if missing
    const emailToLookup = order.buyer_email || order.customer_email;
    if (emailToLookup) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", emailToLookup.toLowerCase().trim())
        .single();
      if (profile) {
        updatePayload.customer_id = profile.id;
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", params.orderId);

    if (updateError) {
      console.error("[Sync Payment] DB update failed", { orderId: params.orderId, error: updateError });
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    console.log("[Sync Payment] Order synced as paid", { orderId: params.orderId, paymentIntentId, checkedVia });

    await Promise.all([
      supabaseAdmin.from("activity_log").insert({
        order_id: params.orderId,
        action: "payment_synced_manually",
        details: {
          synced_by: actor.email,
          payment_intent: paymentIntentId,
          checked_via: checkedVia,
        },
      }),
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "payment_synced",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: { payment_intent: paymentIntentId, checked_via: checkedVia },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.payment_synced",
        resourceId: params.orderId,
        newValue: { payment_status: "paid", payment_intent_id: paymentIntentId },
      }),
    ]);

    return NextResponse.json({
      success: true,
      synced: true,
      payment_intent_id: paymentIntentId,
      checked_via: checkedVia,
      message: "Payment confirmed via Stripe and order updated.",
    });
  } catch (err: any) {
    console.error("[Sync Payment Error]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
