import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { sendEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

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
    console.log("[Stripe Webhook] checkout.session.completed", {
      orderId,
      paymentIntent: session.payment_intent,
      customerEmail: session.customer_details?.email,
    });

    if (orderId) {
      const paymentStatus = "paid";

      const updatePayload: Record<string, any> = {
        payment_status: paymentStatus,
        payment_intent_id: session.payment_intent,
        paid_at: new Date().toISOString(),
        status: "payment_received",
        ops_status: "payment_received",
        updated_at: new Date().toISOString(),
      };

      const { data: existingOrder } = await supabaseAdmin
        .from("orders")
        .select("customer_id, buyer_email")
        .eq("id", orderId)
        .single();

      if (existingOrder && !existingOrder.customer_id && session.customer_details?.email) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", session.customer_details.email.toLowerCase().trim())
          .single();

        if (profile) {
          updatePayload.customer_id = profile.id;
          console.log("[Stripe Webhook] Backfilling customer_id", { orderId, customerId: profile.id });
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update(updatePayload)
        .eq("id", orderId);

      if (updateError) {
        console.error("[Stripe Webhook] Order update failed", { orderId, error: updateError });
      } else {
        console.log("[Stripe Webhook] Order updated successfully", { orderId, paymentStatus });
      }

      await supabaseAdmin.from("activity_log").insert({
        order_id: orderId,
        action: "payment_received",
        details: {
          payment_intent: session.payment_intent,
          customer_id_backfilled: !existingOrder?.customer_id && !!updatePayload.customer_id,
        },
      });

      const buyerEmail =
        session.customer_details?.email ||
        existingOrder?.buyer_email;

      const { data: fullOrder } = await supabaseAdmin
          .from("orders")
          .select("order_id, vehicle_year, vehicle_make, vehicle_model, package, final_price")
          .eq("id", orderId)
          .maybeSingle();

      if (buyerEmail && fullOrder) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";
        const vehicle = `${fullOrder.vehicle_year || ""} ${fullOrder.vehicle_make || ""} ${fullOrder.vehicle_model || ""}`.trim() || "your vehicle";
        const pkgLabel = fullOrder.package
          ? fullOrder.package.charAt(0).toUpperCase() + fullOrder.package.slice(1)
          : "Assessment";

        await sendEmail({
          to: buyerEmail,
          subject: `Payment Confirmed — RideCheck Assessment for ${vehicle}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
              <div style="background:#059669;padding:24px;border-radius:8px 8px 0 0;text-align:center">
                <h1 style="color:white;margin:0;font-size:22px">Payment Confirmed ✓</h1>
              </div>
              <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:32px">
                <p style="margin:0 0 16px">Your RideCheck assessment has been confirmed and is now in our queue.</p>
                <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px">
                  <p style="margin:0 0 8px;font-size:14px;color:#6b7280;text-transform:uppercase;font-weight:600;letter-spacing:.05em">Assessment Details</p>
                  <p style="margin:0 0 4px;font-weight:600">${vehicle}</p>
                  <p style="margin:0 0 4px;color:#374151">${pkgLabel} Package</p>
                  ${fullOrder.final_price ? `<p style="margin:0;color:#374151">Amount Paid: <strong>$${(fullOrder.final_price / 100).toFixed(2)}</strong></p>` : ""}
                </div>
                <p style="margin:0 0 16px;color:#374151">Our operations team will be in touch shortly to confirm the inspection schedule. You can track your order status anytime:</p>
                <a href="${appUrl}/dashboard" style="display:inline-block;background:#059669;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-bottom:24px">View My Dashboard</a>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
                <p style="margin:0;font-size:12px;color:#9ca3af">Questions? Reply to this email or contact us at <a href="mailto:support@ridecheckauto.com" style="color:#059669">support@ridecheckauto.com</a></p>
              </div>
            </div>
          `,
        });
      }
    } else {
      console.warn("[Stripe Webhook] checkout.session.completed missing order_id in metadata");
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
