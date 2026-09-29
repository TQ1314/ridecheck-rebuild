import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { sendEmail } from "@/lib/email/resend";
import { generateCreditCode } from "@/lib/founding/credit-code";
import { buildSupporterConfirmationEmail, buildGiftRecipientEmail } from "@/lib/email/founding-supporter";
import { notifyOpsTeam } from "@/lib/notifications/notifyOps";
import { expectedStripeAmountCents } from "@/lib/payment/stripe-validation";
import { getPrice, type BookingType, type PackageType } from "@/lib/utils/pricing";

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
  eventDetails?: { eventId: string; amount: number | null; currency: string | null },
  sessionEvidence?: { metadataToken?: string | null; taxCents?: number | null; taxEnabled?: boolean },
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
      "vehicle_year, vehicle_make, vehicle_model, package, final_price, base_price, booking_type, tracking_token, " +
      "stripe_checkout_session_id, stripe_session_id, stripe_payment_intent_id, payment_intent_id, payment_link_token"
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
        base_price: number | null;
        booking_type: string | null;
        tracking_token: string | null;
        stripe_checkout_session_id: string | null;
        stripe_session_id: string | null;
        stripe_payment_intent_id: string | null;
        payment_intent_id: string | null;
        payment_link_token: string | null;
      } | null;
      error: any;
    }>);

  if (fetchError || !existingOrder) {
    console.error("[Stripe Webhook] markOrderPaid — order not found", {
      orderId,
      errorCode: fetchError?.code,
      errorMessage: fetchError?.message,
    });
    return {
      skipped: false,
      error: fetchError ? "Order lookup failed" : "Order not found",
      retryable: !!fetchError,
    };
  }

  console.log("[Stripe Webhook] markOrderPaid — order found", {
    orderId,
    orderNumber: existingOrder.order_number || existingOrder.order_id,
    currentPaymentStatus: existingOrder.payment_status,
    bookingType: existingOrder.booking_type,
  });

  // Idempotency: skip if already paid
  if (existingOrder.payment_status === "paid" || existingOrder.payment_status === "paid_manual_verified") {
    console.log("[Stripe Webhook] markOrderPaid — already paid, skipping", { orderId });
    return { skipped: true };
  }

  const orderPriceDollars = Number(existingOrder.final_price || existingOrder.base_price || 0) ||
    getPrice(
      (existingOrder.package || "standard") as PackageType,
      (existingOrder.booking_type || "concierge") as BookingType,
    ).finalPrice;
  const expectedAmountCents = expectedStripeAmountCents({
    orderPriceDollars,
    stripeTaxCents: sessionEvidence?.taxCents ?? 0,
    includesTax: sessionEvidence?.taxEnabled === true,
  });
  const receivedCurrency = eventDetails?.currency?.toLowerCase();
  if (
    !Number.isSafeInteger(expectedAmountCents) || expectedAmountCents <= 0 ||
    eventDetails?.amount !== expectedAmountCents || receivedCurrency !== "usd"
  ) {
    console.error("[Stripe Webhook] payment amount/currency mismatch — order not activated", {
      orderId,
      expectedAmountCents,
      expectedCurrency: "usd",
      receivedAmountCents: eventDetails?.amount ?? null,
      receivedCurrency: receivedCurrency ?? null,
      stripeEventId: eventDetails?.eventId,
    });
    return { skipped: false, error: "Stripe amount or currency does not match order" };
  }

  if (checkoutSessionId) {
    const linkedSessionId = existingOrder.stripe_checkout_session_id || existingOrder.stripe_session_id;
    if (!linkedSessionId && (!sessionEvidence?.metadataToken ||
      sessionEvidence.metadataToken !== existingOrder.payment_link_token)) {
      console.error("[Stripe Webhook] checkout has no verified order linkage", { orderId, checkoutSessionId });
      return { skipped: false, error: "Checkout session is not linked to order" };
    }
    if (linkedSessionId && linkedSessionId !== checkoutSessionId) {
      console.error("[Stripe Webhook] checkout session does not match order linkage", {
        orderId,
        checkoutSessionId,
        linkedSessionId,
      });
      return { skipped: false, error: "Checkout session is not linked to order" };
    }
    if (
      sessionEvidence?.metadataToken &&
      sessionEvidence.metadataToken !== existingOrder.payment_link_token
    ) {
      console.error("[Stripe Webhook] checkout token does not match order", { orderId, checkoutSessionId });
      return { skipped: false, error: "Checkout payment token does not match order" };
    }
    const linkedIntentId = existingOrder.stripe_payment_intent_id || existingOrder.payment_intent_id;
    if (paymentIntentId && linkedIntentId && linkedIntentId !== paymentIntentId) {
      console.error("[Stripe Webhook] checkout payment intent does not match order linkage", { orderId, paymentIntentId });
      return { skipped: false, error: "Checkout payment intent is not linked to order" };
    }
  } else if (
    paymentIntentId &&
    (existingOrder.stripe_payment_intent_id || existingOrder.payment_intent_id) &&
    (existingOrder.stripe_payment_intent_id || existingOrder.payment_intent_id) !== paymentIntentId
  ) {
    console.error("[Stripe Webhook] payment intent does not match order linkage", { orderId, paymentIntentId });
    return { skipped: false, error: "Payment intent is not linked to order" };
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

  let updateQuery = supabaseAdmin
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);
    // Compare-and-set prevents concurrent webhook deliveries from both
    // sending confirmations, even when they read the same pre-paid status.
  updateQuery = existingOrder.payment_status == null
    ? updateQuery.is("payment_status", null)
    : updateQuery.eq("payment_status", existingOrder.payment_status);
  const { data: updatedRows, error: updateError } = await updateQuery.select("id");

  if (updateError) {
    console.error("[Stripe Webhook] markOrderPaid — DB update failed", {
      orderId,
      errorCode: updateError.code,
      errorMessage: updateError.message,
    });
    return { skipped: false, error: updateError.message, retryable: true };
  }
  if (!updatedRows || updatedRows.length === 0) {
    console.log("[Stripe Webhook] markOrderPaid — concurrent delivery already applied payment", { orderId });
    return { skipped: true };
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
      stripe_event_id:           eventDetails?.eventId ?? null,
      processed_at:              now,
      amount_received:           eventDetails?.amount ?? null,
      currency:                  eventDetails?.currency ?? null,
    },
  });

  const paidAmount = (eventDetails!.amount / 100).toFixed(2);
  const paymentTimestamp = now;
  try {
    await notifyOpsTeam({
      subject: `Payment successful — Order ${existingOrder.order_number || orderId}`,
      body: [
        "PAYMENT SUCCESSFUL",
        `Order: ${existingOrder.order_number || orderId} (${orderId})`,
        `Stripe Checkout: ${checkoutSessionId || "not available"}`,
        `Stripe PaymentIntent: ${paymentIntentId || "not available"}`,
        `Amount actually paid: $${paidAmount} USD`,
        `Customer: ${customerEmail || existingOrder.buyer_email || "not recorded"}`,
        `Vehicle: ${existingOrder.vehicle_year || ""} ${existingOrder.vehicle_make || ""} ${existingOrder.vehicle_model || ""}`.trim(),
        `Package: ${existingOrder.package || "not recorded"}`,
        "Payment status: paid",
        `Timestamp: ${paymentTimestamp}`,
        `Operational status: ${nextOpsStatus}`,
      ].join("\n"),
      smsBody: `RideCheck PAYMENT SUCCESSFUL: Order ${existingOrder.order_number || orderId}; $${paidAmount} USD; ${existingOrder.vehicle_year || ""} ${existingOrder.vehicle_make || ""} ${existingOrder.vehicle_model || ""}; ${nextOpsStatus}.`,
      orderId,
      emailAll: true,
    });
  } catch (notificationError) {
    // Payment is already durable: do not return an error that could replay
    // the payment side effects. The existing Ops notification helper logs
    // individual provider failures; this catches any unexpected rejection.
    console.error("[Stripe Webhook] payment Ops notification failed after payment persisted", {
      orderId,
      stripeEventId: eventDetails?.eventId,
      error: notificationError,
    });
  }

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
                ${existingOrder.order_number ? `<p style="margin:0 0 8px;font-weight:600">Order #${existingOrder.order_number}</p>` : ""}
                <p style="margin:0 0 4px;font-weight:600">${vehicle}</p>
                <p style="margin:0 0 4px;color:#374151">${pkgLabel} Package</p>
                ${existingOrder.final_price ? `<p style="margin:0;color:#374151">Amount Paid: <strong>$${Number(existingOrder.final_price).toFixed(2)}</strong></p>` : ""}
              </div>
              <p style="margin:0 0 16px;color:#374151">${existingOrder.booking_type === "concierge"
                ? "You're all set. We'll take it from here. RideCheck will coordinate with the seller, arrange access to the vehicle, assign a RideChecker, and keep you updated."
                : "Your payment is confirmed. You coordinate access and timing with the seller; share the confirmed details with RideCheck."}</p>
              ${existingOrder.tracking_token
                ? `<a href="${appUrl}/track/${orderId}?t=${encodeURIComponent(existingOrder.tracking_token)}" style="display:inline-block;background:#059669;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-bottom:24px">Track Your Order</a>`
                : `<a href="${appUrl}/dashboard" style="display:inline-block;background:#059669;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-bottom:24px">View My Dashboard</a>`}
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
      if (session.payment_status !== "paid") {
        return NextResponse.json({ received: true, ignored: "session is not paid" });
      }
      console.log("[Stripe Webhook] checkout.session.completed — founding_supporter branch", {
        sessionId: session.id,
      });
      await handleFoundingSupporter(session);
      return NextResponse.json({ received: true });
    }

    // Upgrade sessions charge only the difference and must not be interpreted
    // as payment for an unpaid base inspection order.
    if (sessionType === "package_upgrade") {
      return NextResponse.json({ received: true, ignored: "package upgrade is not a base-order payment" });
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
      // Do not acknowledge a payment event that we cannot reconcile. Stripe
      // will retry this response and Ops can use the event payload to repair
      // the metadata/link rather than silently losing a successful payment.
      return NextResponse.json({ error: "Payment event is missing order_id metadata" }, { status: 422 });
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true, ignored: "session is not paid" });
    }
    if (session.mode !== "payment") {
      console.error("[Stripe Webhook] refusing non-payment checkout session for order", {
        orderId,
        checkoutSessionId: session.id,
        mode: session.mode,
      });
      return NextResponse.json({ received: true, ignored: "checkout session is not a one-time payment" });
    }
    const result = await markOrderPaid(orderId, paymentIntentId, customerEmail, session.id, {
      eventId: event.id,
      amount: typeof session.amount_total === "number" ? session.amount_total : null,
      currency: session.currency ?? null,
    }, {
      metadataToken: session.metadata?.payment_link_token ?? null,
      taxCents: typeof session.total_details?.amount_tax === "number" ? session.total_details.amount_tax : null,
      taxEnabled: session.automatic_tax?.enabled === true,
    });
    if (result.error) {
      return result.retryable
        ? NextResponse.json({ error: "Payment could not be persisted; retrying" }, { status: 500 })
        : NextResponse.json({ received: true, ignored: "Payment evidence did not match order; Ops review required" });
    }
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
      if (intent.status !== "succeeded") {
        return NextResponse.json({ received: true, ignored: "payment intent is not succeeded" });
      }
      const { data: linkedOrder, error: linkedOrderError } = await supabaseAdmin
        .from("orders")
        .select("id, payment_link_token, stripe_payment_intent_id, payment_intent_id, stripe_checkout_session_id, stripe_session_id, final_price, base_price, package, booking_type")
        .eq("id", orderId)
        .maybeSingle();
      if (linkedOrderError || !linkedOrder) {
        return NextResponse.json({ error: "Payment intent order could not be reconciled" }, { status: 500 });
      }
      const intentIsStored = linkedOrder.stripe_payment_intent_id === intent.id ||
        linkedOrder.payment_intent_id === intent.id;
      const metadataTokenMatches = !!intent.metadata?.payment_link_token &&
        intent.metadata.payment_link_token === linkedOrder.payment_link_token;
      if (!intentIsStored && !metadataTokenMatches) {
        console.error("[Stripe Webhook] payment intent is not securely linked to order", { orderId, intentId: intent.id });
        return NextResponse.json({ error: "Payment intent is not securely linked to order" }, { status: 409 });
      }
      // Checkout PaymentIntents carry a reusable order token, not proof that
      // this particular session is the currently linked Checkout. PI-first
      // deliveries must wait for the paid Checkout event to validate its ID.
      if (!intentIsStored && (linkedOrder.stripe_checkout_session_id || linkedOrder.stripe_session_id)) {
        return NextResponse.json({ received: true, ignored: "Awaiting linked Checkout session payment confirmation" });
      }
      // Checkout automatic tax is only fully verifiable from the session's
      // amount_total/tax breakdown. If the PI arrives first and its gross
      // differs from the base price, wait for checkout.session.completed to
      // validate the authoritative Checkout total rather than activating or
      // asking Stripe to retry a legitimate taxed payment indefinitely.
      const intentOrder = linkedOrder as { final_price?: number | null; base_price?: number | null; package?: string | null; booking_type?: string | null };
      const intentPriceDollars = Number(intentOrder.final_price || intentOrder.base_price || 0) ||
        getPrice(
          (intentOrder.package || "standard") as PackageType,
          (intentOrder.booking_type || "concierge") as BookingType,
        ).finalPrice;
      const baseAmountCents = Math.round(intentPriceDollars * 100);
      const amountReceived = typeof intent.amount_received === "number" ? intent.amount_received : null;
      if (
        amountReceived !== baseAmountCents ||
        intent.currency?.toLowerCase() !== "usd"
      ) {
        return NextResponse.json({
          received: true,
          ignored: "PaymentIntent gross will be validated against its Checkout session",
        });
      }
      // No checkoutSessionId available from PI events — pass null
      const result = await markOrderPaid(orderId, intent.id, customerEmail, null, {
        eventId: event.id,
        amount: typeof intent.amount_received === "number" ? intent.amount_received : intent.amount ?? null,
        currency: intent.currency ?? null,
      });
      if (result.error) {
        return result.retryable
          ? NextResponse.json({ error: "Payment could not be persisted; retrying" }, { status: 500 })
          : NextResponse.json({ received: true, ignored: "Payment evidence did not match order; Ops review required" });
      }
    } else {
      console.warn("[Stripe Webhook] payment_intent.succeeded — no order_id in intent metadata; cannot update order", {
        intentId: intent.id,
        metadata: intent.metadata,
      });
      return NextResponse.json({ error: "Payment event is missing order_id metadata" }, { status: 422 });
    }
  }

  // Expired or asynchronously failed Checkout sessions never activate orders.
  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as any;
    const orderId = session.metadata?.order_id;
    if (orderId && session.metadata?.session_type !== "package_upgrade") {
      const { error } = await supabaseAdmin
        .from("orders")
        .update({ payment_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", orderId)
        .eq("stripe_checkout_session_id", session.id)
        .neq("payment_status", "paid")
        .neq("payment_status", "paid_manual_verified")
        .neq("payment_status", "override_approved");
      if (error) {
        console.error("[Stripe Webhook] expired/failed checkout status update failed", { orderId, sessionId: session.id, error });
        return NextResponse.json({ error: "Payment status could not be reconciled; retrying" }, { status: 500 });
      }
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
      const { data: order, error: orderLookupError } = await supabaseAdmin
        .from("orders")
        .select("payment_status, payment_link_token, stripe_payment_intent_id, payment_intent_id")
        .eq("id", orderId)
        .single();
      if (orderLookupError) {
        console.error("[Stripe Webhook] payment failure order lookup failed", orderLookupError);
        return NextResponse.json({ error: "Payment status could not be reconciled; retrying" }, { status: 500 });
      }

      const intentIsStored = order?.stripe_payment_intent_id === intent.id ||
        order?.payment_intent_id === intent.id;
      const metadataTokenMatches = !!intent.metadata?.payment_link_token &&
        intent.metadata.payment_link_token === order?.payment_link_token;
      if (order && !intentIsStored && !metadataTokenMatches) {
        console.warn("[Stripe Webhook] ignoring unlinked payment_intent.payment_failed", { orderId, intentId: intent.id });
        return NextResponse.json({ received: true, ignored: "payment intent is not linked to order" });
      }

      if (order && !["paid", "paid_manual_verified", "override_approved"].includes(order.payment_status)) {
        const { error: failedUpdateError } = await supabaseAdmin
          .from("orders")
          .update({
            payment_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .neq("payment_status", "paid")
          .neq("payment_status", "paid_manual_verified")
          .neq("payment_status", "override_approved");
        if (failedUpdateError) {
          console.error("[Stripe Webhook] payment failure status could not be persisted", failedUpdateError);
          return NextResponse.json({ error: "Payment status could not be persisted; retrying" }, { status: 500 });
        }

        console.log("[Stripe Webhook] payment_intent.payment_failed — order marked failed", { orderId });
      } else if (order?.payment_status === "paid") {
        console.log("[Stripe Webhook] payment_intent.payment_failed — ignoring, order already paid", { orderId });
      }
    } else {
      console.warn("[Stripe Webhook] payment_intent.payment_failed — missing order_id metadata", {
        intentId: intent.id,
      });
      return NextResponse.json({ error: "Payment event is missing order_id metadata" }, { status: 422 });
    }
  }

  return NextResponse.json({ received: true });
}
