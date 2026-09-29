import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia" as any,
});

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", params.orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.booking_type !== "concierge") {
      return NextResponse.json(
        { error: "Payment request only available for concierge orders" },
        { status: 400 }
      );
    }

    if (["paid", "paid_manual_verified", "override_approved"].includes(order.payment_status)) {
      return NextResponse.json(
        { error: "Order already paid" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";
    const finalPrice = Number(order.final_price);
    if (!Number.isFinite(finalPrice) || !Number.isSafeInteger(Math.round(finalPrice * 100)) || finalPrice <= 0) {
      return NextResponse.json({ error: "Order price is invalid; payment request not created" }, { status: 409 });
    }
    const linkedSessionId = order.stripe_checkout_session_id || order.stripe_session_id;
    if (linkedSessionId) {
      let existingSession: Stripe.Checkout.Session;
      try {
        existingSession = await stripe.checkout.sessions.retrieve(linkedSessionId);
      } catch (sessionError) {
        console.error("[Request Payment] Could not verify existing session", { orderId: params.orderId, linkedSessionId, error: sessionError });
        return NextResponse.json({ error: "Existing payment session cannot be checked; contact support" }, { status: 503 });
      }
      if (existingSession.status === "open" && existingSession.url) {
        return NextResponse.json({ success: true, payment_url: existingSession.url, reused: true });
      }
      if (existingSession.status === "complete") {
        return NextResponse.json({ error: "Payment is processing. Check the order payment status before requesting again." }, { status: 409 });
      }
      if (existingSession.status !== "expired") {
        return NextResponse.json({ error: "Existing payment session is not ready for replacement" }, { status: 409 });
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `RideCheck ${(order.package || "standard").charAt(0).toUpperCase() + (order.package || "standard").slice(1)} Assessment`,
              description: `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`,
            },
            unit_amount: Math.round(finalPrice * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        order_id: params.orderId,
        customer_email: order.buyer_email || order.customer_email || "",
        ...(order.payment_link_token && { payment_link_token: order.payment_link_token }),
      },
      payment_intent_data: {
        metadata: {
          order_id: params.orderId,
          ...(order.payment_link_token && { payment_link_token: order.payment_link_token }),
        },
      },
      success_url: `${appUrl}/order/received?orderId=${params.orderId}&status=paid${order.tracking_token ? `&track=${encodeURIComponent(`/track/${params.orderId}?t=${order.tracking_token}`)}` : ""}`,
      cancel_url: `${appUrl}/order/received?orderId=${params.orderId}&status=cancelled${order.tracking_token ? `&track=${encodeURIComponent(`/track/${params.orderId}?t=${order.tracking_token}`)}` : ""}`,
    }, { idempotencyKey: `ridecheck-admin-checkout:${params.orderId}:${linkedSessionId || "first"}` });

    const now = new Date().toISOString();

    let linkQuery = supabaseAdmin
      .from("orders")
      .update({
        payment_status: "requested",
        payment_requested_at: now,
        payment_link_url: session.url,
        stripe_session_id: session.id,
        stripe_checkout_session_id: session.id,
        status: "payment_requested",
        ops_status: "payment_pending",
        updated_at: now,
      })
      .eq("id", params.orderId)
      .eq("payment_status", order.payment_status);
    linkQuery = order.stripe_session_id
      ? linkQuery.eq("stripe_session_id", order.stripe_session_id)
      : linkQuery.is("stripe_session_id", null);
    const { data: linked, error: linkError } = await linkQuery.select("id");
    if (linkError || !linked?.length) {
      console.error("[Request Payment] Checkout created but order linkage failed", { orderId: params.orderId, error: linkError });
      return NextResponse.json({ error: "Payment session could not be linked; contact support" }, { status: 503 });
    }

    const buyerEmail = order.buyer_email || order.customer_email;
    if (buyerEmail && buyerEmail !== "guest@ridecheckauto.com") {
      try {
        const { sendEmail } = await import("@/lib/email/resend");
        const { paymentRequestHtml } = await import("@/lib/email/templates/payment-request");
        await sendEmail({
          to: buyerEmail,
          subject: `RideCheck - Payment Required (Order ${params.orderId})`,
          html: paymentRequestHtml({
            orderId: params.orderId,
            customerName: order.customer_name || order.buyer_email || "Customer",
            finalPrice: finalPrice.toFixed(2),
            paymentUrl: session.url!,
          }),
        });
      } catch (emailErr) {
        console.error("[Payment Email Error]", emailErr);
      }
    }

    await Promise.all([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "payment_requested",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: { payment_url: session.url, amount: finalPrice },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.payment_requested",
        resourceId: params.orderId,
        newValue: {
          payment_status: "requested",
          stripe_session_id: session.id,
          amount: finalPrice,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      payment_url: session.url,
    });
  } catch (err: any) {
    console.error("[Request Payment Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
