import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia" as any,
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
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

    if (order.payment_status === "paid") {
      return NextResponse.json(
        { error: "Order already paid" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ridecheck.com";
    const finalPrice = Number(order.final_price || order.base_price || 14900);

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
      metadata: { order_id: params.orderId },
      success_url: `${appUrl}/order/received?orderId=${params.orderId}&status=paid`,
      cancel_url: `${appUrl}/order/received?orderId=${params.orderId}&status=cancelled`,
    });

    const now = new Date().toISOString();

    await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "requested",
        payment_requested_at: now,
        payment_link_url: session.url,
        status: "payment_requested",
        ops_status: "payment_pending",
        updated_at: now,
      })
      .eq("id", params.orderId);

    const buyerEmail = order.buyer_email || order.customer_email;
    if (buyerEmail && buyerEmail !== "guest@ridecheck.com") {
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
        resourceType: "order",
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
