import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canSendPayment, type Role } from "@/lib/utils/roles";
import { getStripe } from "@/lib/stripe/server";
import { sendEmail } from "@/lib/email/resend";
import { paymentRequestHtml } from "@/lib/email/templates/payment-request";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !canSendPayment(profile.role as Role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", params.orderId)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.payment_status !== "not_requested") {
      return NextResponse.json(
        { error: "Payment already requested or paid" },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    let paymentUrl = "";

    if (stripe) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `RideCheck ${order.package.charAt(0).toUpperCase() + order.package.slice(1)} Assessment`,
                description: `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`,
              },
              unit_amount: Math.round(Number(order.final_price) * 100),
            },
            quantity: 1,
          },
        ],
        metadata: { order_id: params.orderId },
        success_url: `${appUrl}/orders/${params.orderId}?payment=success`,
        cancel_url: `${appUrl}/orders/${params.orderId}?payment=cancelled`,
      });
      paymentUrl = checkoutSession.url || "";
    }

    await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "requested",
        status: "payment_requested",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.orderId);

    await supabaseAdmin.from("activity_log").insert({
      user_id: session.user.id,
      order_id: params.orderId,
      action: "payment_requested",
      details: { payment_url: paymentUrl },
    });

    if (order.customer_email && paymentUrl) {
      sendEmail({
        to: order.customer_email,
        subject: `Payment Required - Order ${params.orderId}`,
        html: paymentRequestHtml({
          orderId: params.orderId,
          customerName: order.customer_name,
          finalPrice: String(order.final_price),
          paymentUrl,
        }),
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, payment_url: paymentUrl });
  } catch (err: any) {
    console.error("[Send Payment Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
