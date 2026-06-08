import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { sendEmail } from "@/lib/email/resend";
import { generateCreditCode } from "@/lib/founding/credit-code";
import { buildSupporterConfirmationEmail, buildGiftRecipientEmail } from "@/lib/email/founding-supporter";

export const dynamic = "force-dynamic";

async function handleFoundingSupporter(session: any) {
  const meta = session.metadata ?? {};
  const tier = meta.tier as string;

  if (!tier || !meta.supporter_email) {
    console.error("[Stripe Webhook] founding_supporter missing metadata", { sessionId: session.id });
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from("ridecheck_credits")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (existing) {
    console.log("[Stripe Webhook] founding_supporter already processed", { sessionId: session.id });
    return;
  }

  const tierCredits: Record<string, number> = {
    backer: 1, believer: 1, founding_partner: 2,
  };
  const tierAmounts: Record<string, number> = {
    backer: 10_000, believer: 20_000, founding_partner: 30_000,
  };

  const creditsCount  = tierCredits[tier]  ?? 1;
  const amountCents   = tierAmounts[tier]  ?? 10_000;
  const creditCode    = generateCreditCode(tier);
  const now           = new Date();
  const expiresAt     = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate()).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from("ridecheck_credits")
    .insert({
      session_type:          "founding_supporter",
      tier,
      amount_cents:          amountCents,
      credits_count:         creditsCount,
      credit_code:           creditCode,
      supporter_name:        meta.supporter_name  ?? "",
      supporter_email:       meta.supporter_email,
      supporter_phone:       meta.supporter_phone || null,
      gift_recipient_name:   meta.gift_recipient_name  || null,
      gift_recipient_email:  meta.gift_recipient_email || null,
      gift_message:          meta.gift_message         || null,
      list_on_partners_page: meta.list_on_partners_page === "true",
      stripe_session_id:     session.id,
      status:                "active",
      expires_at:            expiresAt,
      updated_at:            now.toISOString(),
    });

  if (insertError) {
    console.error("[Stripe Webhook] founding_supporter insert failed", insertError);
    return;
  }

  console.log("[Stripe Webhook] founding_supporter credit created", { creditCode, tier, sessionId: session.id });

  const { subject: confSubject, html: confHtml } = buildSupporterConfirmationEmail({
    name:         meta.supporter_name ?? "Supporter",
    tier,
    creditCode,
    creditsCount,
    expiresAt,
  });
  await sendEmail({ to: meta.supporter_email, subject: confSubject, html: confHtml }).catch((e) =>
    console.error("[Stripe Webhook] supporter email failed", e)
  );

  if (meta.gift_recipient_email && meta.gift_recipient_name) {
    const { subject: giftSubject, html: giftHtml } = buildGiftRecipientEmail({
      senderName:    meta.supporter_name ?? "Someone",
      recipientName: meta.gift_recipient_name,
      giftMessage:   meta.gift_message || null,
      creditCode,
      tier,
      creditsCount,
      expiresAt,
    });
    await sendEmail({ to: meta.gift_recipient_email, subject: giftSubject, html: giftHtml }).catch((e) =>
      console.error("[Stripe Webhook] gift email failed", e)
    );
  }
}

// ─── markOrderPaid ────────────────────────────────────────────────────────────
// Called by both checkout.session.completed and payment_intent.succeeded events.
// checkoutSessionId: the cs_... ID (only available from checkout events)
// paymentIntentId:   the pi_... ID
async function markOrderPaid(
  orderId: string,
  paymentIntentId: string | null,
  customerEmail?: string | null,
  checkoutSessionId?: string | null,
) {
  console.log("[Stripe Webhook] markOrderPaid — looking up order", {
    orderId,
    paymentIntentId: paymentIntentId ? `${paymentIntentId.slice(0, 8)}…` : null,
    checkoutSessionId: checkoutSessionId ? `${checkoutSessionId.slice(0, 8)}…` : null,
  });

  const { data: existingOrder, error: fetchError } = await (supabaseAdmin
    .from("orders")
    .select(
      "id, payment_status, customer_id, buyer_email, order_id, order_number, " +
      "vehicle_year, vehicle_make, vehicle_model, package, final_price, booking_type"
    )
    .eq("id", orderId)
    .single() as unknown as Promise<{
      data: {
        id: string;
        payment_status: string | null;
        customer_id: string | null;
        buyer_email: string | null;
        order_id: string | null;
        order_number: string | null;
        vehicle_year: string | null;
        vehicle_make: string | null;
        vehicle_model: string | null;
        package: string | null;
        final_price: number | null;
        booking_type: string | null;
      } | null;
      error: any;
    }>);

  if (fetchError || !existingOrder) {
    console.error("[Stripe Webhook] markOrderPaid — order not found", {
      orderId,
      errorCode: fetchError?.code,
      errorMessage: fetchError?.message,
    });
    return { skipped: false, error: "Order not found" };
  }

  console.log("[Stripe Webhook] markOrderPaid — order found", {
    orderId,
    orderNumber: existingOrder.order_number || existingOrder.order_id,
    currentPaymentStatus: existingOrder.payment_status,
    bookingType: existingOrder.booking_type,
  });

  // Idempotency: skip if already paid
  if (existingOrder.payment_status === "paid") {
    console.log("[Stripe Webhook] markOrderPaid — already paid, skipping", { orderId });
    return { skipped: true };
  }

  const now = new Date().toISOString();

  // For concierge orders, next ops step is contact_seller (need to reach out to seller).
  // For self_arrange, ops just waits for buyer to confirm the inspection time.
  const nextOpsStatus = existingOrder.booking_type === "concierge"
    ? "contact_seller"
    : "payment_received";

  const updatePayload: Record<string, any> = {
    payment_status:             "paid",
    payment_intent_id:          paymentIntentId,     // legacy column (keep for compat)
    stripe_payment_intent_id:   paymentIntentId,     // canonical column (migration 046)
    paid_at:                    now,
    status:                     "payment_received",
    ops_status:                 nextOpsStatus,
    updated_at:                 now,
  };

  // Save the checkout session ID if we have it
  if (checkoutSessionId) {
    updatePayload.stripe_session_id          = checkoutSessionId; // legacy column
    updatePayload.stripe_checkout_session_id = checkoutSessionId; // canonical column
  }

  // Backfill customer_id if missing
  const emailToLookup = customerEmail || existingOrder.buyer_email;
  if (!existingOrder.customer_id && emailToLookup) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", emailToLookup.toLowerCase().trim())
      .single();

    if (profile) {
      updatePayload.customer_id = profile.id;
      console.log("[Stripe Webhook] markOrderPaid — backfilling customer_id", {
        orderId,
        customerId: profile.id,
      });
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (updateError) {
    console.error("[Stripe Webhook] markOrderPaid — DB update failed", {
      orderId,
      errorCode: updateError.code,
      errorMessage: updateError.message,
    });
    return { skipped: false, error: updateError.message };
  }

  console.log("[Stripe Webhook] markOrderPaid — order updated successfully", {
    orderId,
    orderNumber: existingOrder.order_number || existingOrder.order_id,
    paymentIntentId,
    checkoutSessionId,
    nextOpsStatus,
  });

  await supabaseAdmin.from("activity_log").insert({
    order_id: orderId,
    action: "payment_received",
    details: {
      payment_intent:            paymentIntentId,
      checkout_session:          checkoutSessionId ?? null,
      ops_status_set:            nextOpsStatus,
      booking_type:              existingOrder.booking_type,
      customer_id_backfilled:    !existingOrder.customer_id && !!updatePayload.customer_id,
    },
  });

  // Send buyer confirmation email
  const buyerEmail = customerEmail || existingOrder.buyer_email;
  if (buyerEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";
    const vehicle = `${existingOrder.vehicle_year || ""} ${existingOrder.vehicle_make || ""} ${existingOrder.vehicle_model || ""}`.trim() || "your vehicle";
    const pkgLabel = existingOrder.package
      ? existingOrder.package.charAt(0).toUpperCase() + existingOrder.package.slice(1)
      : "Assessment";

    try {
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
                ${existingOrder.final_price ? `<p style="margin:0;color:#374151">Amount Paid: <strong>$${Number(existingOrder.final_price).toFixed(2)}</strong></p>` : ""}
              </div>
              <p style="margin:0 0 16px;color:#374151">Our operations team will be in touch shortly to confirm the inspection schedule. You can track your order status anytime:</p>
              <a href="${appUrl}/dashboard" style="display:inline-block;background:#059669;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-bottom:24px">View My Dashboard</a>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
              <p style="margin:0;font-size:12px;color:#9ca3af">Questions? Reply to this email or contact us at <a href="mailto:support@ridecheckauto.com" style="color:#059669">support@ridecheckauto.com</a></p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("[Stripe Webhook] markOrderPaid — confirmation email failed", { orderId, emailErr });
    }
  }

  return { skipped: false };
}

// ─── Webhook POST handler ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    console.error("[Stripe Webhook] Stripe not configured");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error("[Stripe Webhook] Missing signature or secret", {
      hasSig: !!sig,
      hasSecret: !!webhookSecret,
    });
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed — check STRIPE_WEBHOOK_SECRET matches the Stripe dashboard endpoint secret", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("[Stripe Webhook] Event received", { type: event.type, id: event.id });

  // ── checkout.session.completed ───────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const sessionType = session.metadata?.session_type;

    if (sessionType === "founding_supporter") {
      console.log("[Stripe Webhook] checkout.session.completed — founding_supporter branch", {
        sessionId: session.id,
      });
      await handleFoundingSupporter(session);
      return NextResponse.json({ received: true });
    }

    const orderId      = session.metadata?.order_id;
    const customerEmail = session.customer_details?.email || session.metadata?.customer_email;
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as any)?.id ?? null;

    console.log("[Stripe Webhook] checkout.session.completed — standard order branch", {
      sessionId: session.id,
      orderId,
      paymentIntentId,
      customerEmail,
      paymentStatus: session.payment_status,
    });

    if (!orderId) {
      console.warn("[Stripe Webhook] checkout.session.completed — no order_id in session metadata; cannot update order", {
        sessionId: session.id,
        metadata: session.metadata,
      });
      return NextResponse.json({ received: true });
    }

    await markOrderPaid(orderId, paymentIntentId, customerEmail, session.id);
  }

  // ── payment_intent.succeeded ─────────────────────────────────────────────
  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as any;
    const orderId       = intent.metadata?.order_id;
    const customerEmail = intent.receipt_email || intent.metadata?.customer_email;

    console.log("[Stripe Webhook] payment_intent.succeeded", {
      intentId: intent.id,
      orderId,
      customerEmail,
    });

    if (orderId) {
      // No checkoutSessionId available from PI events — pass null
      await markOrderPaid(orderId, intent.id, customerEmail, null);
    } else {
      console.warn("[Stripe Webhook] payment_intent.succeeded — no order_id in intent metadata; cannot update order", {
        intentId: intent.id,
        metadata: intent.metadata,
      });
    }
  }

  // ── payment_intent.payment_failed ────────────────────────────────────────
  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as any;
    const orderId = intent.metadata?.order_id;

    console.log("[Stripe Webhook] payment_intent.payment_failed", {
      intentId: intent.id,
      orderId,
      failureMessage: intent.last_payment_error?.message,
    });

    if (orderId) {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("payment_status")
        .eq("id", orderId)
        .single();

      if (order && order.payment_status !== "paid") {
        await supabaseAdmin
          .from("orders")
          .update({
            payment_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        console.log("[Stripe Webhook] payment_intent.payment_failed — order marked failed", { orderId });
      } else if (order?.payment_status === "paid") {
        console.log("[Stripe Webhook] payment_intent.payment_failed — ignoring, order already paid", { orderId });
      }
    }
  }

  return NextResponse.json({ received: true });
}
