import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { getStripe } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

const PAID_STATUSES = ["paid", "paid_manual_verified"];

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    // Optional: caller can supply a specific Stripe ID to try
    let body: { stripe_id?: string } = {};
    try { body = await req.json(); } catch { /* no body is fine */ }
    const manualStripeId = body.stripe_id?.trim() || null;

    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status, stripe_session_id, payment_intent_id, buyer_email, customer_email")
      .eq("id", params.orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Already paid in any form — nothing to sync
    if (PAID_STATUSES.includes(order.payment_status)) {
      return NextResponse.json({
        success: true,
        already_paid: true,
        message: order.payment_status === "paid_manual_verified"
          ? "Order was manually verified — no Stripe sync needed."
          : "Order is already marked as paid.",
      });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    let stripePaid = false;
    let stripeUnpaid = false; // Stripe found but not paid yet
    let paymentIntentId: string | null = null;
    let checkedVia: string = "none";
    const checked: string[] = [];

    // Helper: try a checkout session by ID
    async function trySession(sessionId: string): Promise<boolean> {
      try {
        const session = await stripe!.checkout.sessions.retrieve(sessionId);
        checked.push(`session:${sessionId.slice(-8)}`);
        checkedVia = "session";
        if (session.payment_status === "paid") {
          paymentIntentId = typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent as any)?.id ?? null;
          return true;
        }
        stripeUnpaid = true;
        console.log("[Sync Payment] Session found but not paid", { sessionId, paymentStatus: session.payment_status });
        return false;
      } catch (err: any) {
        console.warn("[Sync Payment] Session lookup failed", { sessionId: sessionId.slice(-8), msg: err.message });
        return false;
      }
    }

    // Helper: try a payment intent by ID
    async function tryPaymentIntent(piId: string): Promise<boolean> {
      try {
        const intent = await stripe!.paymentIntents.retrieve(piId);
        checked.push(`pi:${piId.slice(-8)}`);
        checkedVia = "payment_intent";
        if (intent.status === "succeeded") {
          paymentIntentId = intent.id;
          return true;
        }
        stripeUnpaid = true;
        console.log("[Sync Payment] Payment intent found but not succeeded", { piId, status: intent.status });
        return false;
      } catch (err: any) {
        console.warn("[Sync Payment] Payment intent lookup failed", { piId: piId.slice(-8), msg: err.message });
        return false;
      }
    }

    // 1. Try manually supplied Stripe ID first (could be cs_ or pi_)
    if (manualStripeId && !stripePaid) {
      if (manualStripeId.startsWith("cs_")) {
        stripePaid = await trySession(manualStripeId);
      } else if (manualStripeId.startsWith("pi_")) {
        stripePaid = await tryPaymentIntent(manualStripeId);
      }
    }

    // 2. Try stored stripe_session_id
    if (!stripePaid && order.stripe_session_id && order.stripe_session_id !== manualStripeId) {
      stripePaid = await trySession(order.stripe_session_id);
    }

    // 3. Try stored payment_intent_id
    if (!stripePaid && order.payment_intent_id && order.payment_intent_id !== manualStripeId) {
      stripePaid = await tryPaymentIntent(order.payment_intent_id);
    }

    if (!stripePaid) {
      const hasStripeData = checked.length > 0;
      console.log("[Sync Payment] Not paid", { orderId: params.orderId, checked, stripeUnpaid });

      let message: string;
      if (stripeUnpaid && hasStripeData) {
        message =
          "Stripe payment found but it has not completed. If the buyer says they paid, use Manual Verification with evidence.";
      } else if (!hasStripeData) {
        message =
          "No Stripe session or payment intent is linked to this order yet. If payment was made, use Manual Verification with evidence and the Stripe payment reference.";
      } else {
        message =
          "Stripe does not show this order as paid. If Stripe confirms payment, use Manual Verification with the Stripe payment reference.";
      }

      return NextResponse.json({
        success: false,
        synced: false,
        message,
        checked_via: checkedVia,
        checked_ids: checked,
        suggest_manual: true,
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
