import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { sendEmail } from "@/lib/email/resend";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook Error]", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const orderId = session.metadata?.order_id;
    const isInternalTest = session.metadata?.is_internal_test === "true";

    if (orderId) {
      const paymentStatus = isInternalTest ? "paid_test" : "paid";

      await supabaseAdmin
        .from("orders")
        .update({
          payment_status: paymentStatus,
          payment_intent_id: session.payment_intent,
          paid_at: new Date().toISOString(),
          status: "payment_received",
          ops_status: "payment_received",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      await supabaseAdmin.from("activity_log").insert({
        order_id: orderId,
        action: isInternalTest ? "test_payment_received" : "payment_received",
        details: {
          payment_intent: session.payment_intent,
          ...(isInternalTest && { is_internal_test: true, test_run_id: session.metadata?.test_run_id }),
        },
      });
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as any;
    const orderId = intent.metadata?.order_id;
    if (orderId) {
      await supabaseAdmin
        .from("orders")
        .update({
          payment_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
    }
  }

  return NextResponse.json({ received: true });
}
