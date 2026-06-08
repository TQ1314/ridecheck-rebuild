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
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    // Optional: caller can supply a specific Stripe ID to check (cs_ or pi_)
    let body: { stripe_id?: string } = {};
    try { body = await req.json(); } catch { /* no body is fine */ }
    const manualStripeId = body.stripe_id?.trim() || null;

    console.log("[Sync Payment] Request received", {
      orderId: params.orderId,
      manualStripeId: manualStripeId ? `${manualStripeId.slice(0, 8)}…` : null,
      requestedBy: actor.email,
    });

    const { data: order, error: fetchError } = await (supabaseAdmin
      .from("orders")
      .select(
        "id, payment_status, stripe_session_id, stripe_checkout_session_id, " +
        "payment_intent_id, stripe_payment_intent_id, buyer_email, customer_email, booking_type"
      )
      .eq("id", params.orderId)
      .single() as unknown as Promise<{
        data: {
          id: string;
          payment_status: string | null;
          stripe_session_id: string | null;
          stripe_checkout_session_id: string | null;
          payment_intent_id: string | null;
          stripe_payment_intent_id: string | null;
          buyer_email: string | null;
          customer_email: string | null;
          booking_type: string | null;
        } | null;
        error: any;
      }>);

    if (fetchError || !order) {
      console.error("[Sync Payment] Order not found", { orderId: params.orderId, error: fetchError?.message });
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    console.log("[Sync Payment] Order found", {
      orderId: params.orderId,
      currentPaymentStatus: order.payment_status,
      hasStripeSessionId: !!(order.stripe_session_id || order.stripe_checkout_session_id),
      hasPaymentIntentId: !!(order.payment_intent_id || order.stripe_payment_intent_id),
      bookingType: order.booking_type,
    });

    if (order.payment_status && PAID_STATUSES.includes(order.payment_status)) {
      console.log("[Sync Payment] Order already paid — no sync needed", {
        orderId: params.orderId,
        paymentStatus: order.payment_status,
      });
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
    let stripeUnpaid = false;
    let resolvedPaymentIntentId: string | null = null;
    let resolvedCheckoutSessionId: string | null = null;
    let checkedVia: string = "none";
    const checked: string[] = [];

    // Helper: check a checkout session
    async function trySession(sessionId: string): Promise<boolean> {
      try {
        const session = await stripe!.checkout.sessions.retrieve(sessionId);
        checked.push(`session:${sessionId.slice(-8)}`);
        checkedVia = "session";
        resolvedCheckoutSessionId = session.id;

        if (session.payment_status === "paid") {
          resolvedPaymentIntentId = typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent as any)?.id ?? null;

          console.log("[Sync Payment] Session confirms paid", {
            sessionId: sessionId.slice(-8),
            paymentIntentId: resolvedPaymentIntentId,
          });
          return true;
        }
        stripeUnpaid = true;
        console.log("[Sync Payment] Session found but not paid", {
          sessionId: sessionId.slice(-8),
          paymentStatus: session.payment_status,
        });
        return false;
      } catch (err: any) {
        console.warn("[Sync Payment] Session lookup failed", {
          sessionId: sessionId.slice(-8),
          error: err.message,
        });
        return false;
      }
    }

    // Helper: check a payment intent
    async function tryPaymentIntent(piId: string): Promise<boolean> {
      try {
        const intent = await stripe!.paymentIntents.retrieve(piId);
        checked.push(`pi:${piId.slice(-8)}`);
        checkedVia = "payment_intent";

        if (intent.status === "succeeded") {
          resolvedPaymentIntentId = intent.id;
          console.log("[Sync Payment] PaymentIntent confirms succeeded", {
            piId: piId.slice(-8),
            amount: intent.amount,
          });
          return true;
        }
        stripeUnpaid = true;
        console.log("[Sync Payment] PaymentIntent found but not succeeded", {
          piId: piId.slice(-8),
          status: intent.status,
        });
        return false;
      } catch (err: any) {
        console.warn("[Sync Payment] PaymentIntent lookup failed", {
          piId: piId.slice(-8),
          error: err.message,
        });
        return false;
      }
    }

    // 1. Try manually-supplied Stripe ID first
    if (manualStripeId && !stripePaid) {
      if (manualStripeId.startsWith("cs_")) {
        stripePaid = await trySession(manualStripeId);
      } else if (manualStripeId.startsWith("pi_")) {
        stripePaid = await tryPaymentIntent(manualStripeId);
      }
    }

    // 2. Try stored checkout session IDs (canonical column first, then legacy)
    const storedSessionId = order.stripe_checkout_session_id || order.stripe_session_id;
    if (!stripePaid && storedSessionId && storedSessionId !== manualStripeId) {
      stripePaid = await trySession(storedSessionId);
    }

    // 3. Try stored payment intent IDs (canonical column first, then legacy)
    const storedIntentId = order.stripe_payment_intent_id || order.payment_intent_id;
    if (!stripePaid && storedIntentId && storedIntentId !== manualStripeId) {
      stripePaid = await tryPaymentIntent(storedIntentId);
    }

    if (!stripePaid) {
      const hasStripeData = checked.length > 0;
      console.log("[Sync Payment] Not paid — no Stripe confirmation", {
        orderId: params.orderId,
        checked,
        stripeUnpaid,
        hasStripeData,
      });

      let message: string;
      if (stripeUnpaid && hasStripeData) {
        message = "Stripe payment found but it has not completed. If the buyer says they paid, use Manual Verification with evidence.";
      } else if (!hasStripeData) {
        message = "No Stripe session or payment intent linked to this order. Enter the pi_... or cs_... ID from your Stripe dashboard, then click Sync again.";
      } else {
        message = "Stripe does not show this order as paid. If Stripe confirms payment, enter the Stripe payment reference and use Manual Verification.";
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

    // ── Stripe confirms paid — update the order ──────────────────────────────
    const now = new Date().toISOString();

    // Concierge orders: next ops step is contact_seller.
    // Self-arrange: stays at payment_received (buyer arranges the inspection).
    const nextOpsStatus = order.booking_type === "concierge" ? "contact_seller" : "payment_received";

    const updatePayload: Record<string, any> = {
      payment_status:           "paid",
      paid_at:                  now,
      status:                   "payment_received",
      ops_status:               nextOpsStatus,
      updated_at:               now,
    };

    if (resolvedPaymentIntentId) {
      updatePayload.payment_intent_id        = resolvedPaymentIntentId; // legacy
      updatePayload.stripe_payment_intent_id = resolvedPaymentIntentId; // canonical
    }
    if (resolvedCheckoutSessionId) {
      updatePayload.stripe_session_id          = resolvedCheckoutSessionId; // legacy
      updatePayload.stripe_checkout_session_id = resolvedCheckoutSessionId; // canonical
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
      console.error("[Sync Payment] DB update failed", {
        orderId: params.orderId,
        errorCode: updateError.code,
        errorMessage: updateError.message,
      });
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    console.log("[Sync Payment] Order synced as paid successfully", {
      orderId: params.orderId,
      resolvedPaymentIntentId,
      resolvedCheckoutSessionId,
      checkedVia,
      nextOpsStatus,
      syncedBy: actor.email,
    });

    await Promise.all([
      supabaseAdmin.from("activity_log").insert({
        order_id: params.orderId,
        action: "payment_synced_manually",
        details: {
          synced_by:              actor.email,
          payment_intent:         resolvedPaymentIntentId,
          checkout_session:       resolvedCheckoutSessionId,
          checked_via:            checkedVia,
          ops_status_set:         nextOpsStatus,
          booking_type:           order.booking_type,
        },
      }),
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "payment_synced",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: {
          payment_intent:   resolvedPaymentIntentId,
          checkout_session: resolvedCheckoutSessionId,
          checked_via:      checkedVia,
          ops_status_set:   nextOpsStatus,
        },
      }),
      writeAuditLog({
        actorId:    actor.userId,
        actorEmail: actor.email,
        actorRole:  actor.role,
        action:     "order.payment_synced",
        resourceId: params.orderId,
        newValue: {
          payment_status:         "paid",
          stripe_payment_intent_id: resolvedPaymentIntentId,
          stripe_checkout_session_id: resolvedCheckoutSessionId,
          ops_status:             nextOpsStatus,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      synced: true,
      payment_intent_id: resolvedPaymentIntentId,
      checkout_session_id: resolvedCheckoutSessionId,
      checked_via: checkedVia,
      ops_status: nextOpsStatus,
      message: `Payment confirmed via Stripe. Order updated to paid. Next ops step: ${nextOpsStatus.replace(/_/g, " ")}.`,
    });
  } catch (err: any) {
    console.error("[Sync Payment] Unhandled error", { orderId: params.orderId, error: err.message });
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
