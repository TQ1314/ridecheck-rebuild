import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { getPrice, type PackageType, type BookingType } from "@/lib/utils/pricing";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, token } = body;

    if (!orderId || !token) {
      return NextResponse.json({ error: "Missing orderId or token" }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, payment_link_token, payment_status, stripe_checkout_session_id, stripe_session_id, vehicle_year, vehicle_make, vehicle_model, booking_type, package, base_price, final_price, tracking_token, buyer_email, customer_email")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.payment_link_token || order.payment_link_token !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    if (["paid", "paid_manual_verified", "override_approved"].includes(order.payment_status)) {
      return NextResponse.json({ error: "Already paid" }, { status: 400 });
    }

    const linkedSessionId = order.stripe_checkout_session_id || order.stripe_session_id;
    if (linkedSessionId) {
      let linkedSession: any;
      try {
        linkedSession = await stripe.checkout.sessions.retrieve(linkedSessionId);
      } catch (retrieveError) {
        console.error("[Pay Create Session] existing Checkout session could not be checked", {
          orderId,
          sessionId: linkedSessionId,
          error: retrieveError,
        });
        return NextResponse.json({ error: "Existing payment session status could not be checked. Contact support before retrying." }, { status: 503 });
      }
      if (linkedSession.status === "open" && linkedSession.url) {
        return NextResponse.json({ url: linkedSession.url, reused: true });
      }
      if (linkedSession.status === "complete") {
        return NextResponse.json({ error: "Payment is processing. Refresh the order status before retrying." }, { status: 409 });
      }
      if (linkedSession.status === "expired") {
        let expireQuery = supabaseAdmin
          .from("orders")
          .update({ payment_status: "failed", updated_at: new Date().toISOString() })
          .eq("id", orderId);
        expireQuery = order.stripe_checkout_session_id
          ? expireQuery.eq("stripe_checkout_session_id", linkedSessionId)
          : expireQuery.eq("stripe_session_id", linkedSessionId);
        expireQuery = order.payment_status == null
          ? expireQuery.is("payment_status", null)
          : expireQuery.eq("payment_status", order.payment_status);
        const { data: expiredRows, error: expireError } = await expireQuery.select("id");
        if (expireError) {
          console.error("[Pay Create Session] expired session state could not be recorded", { orderId, linkedSessionId, error: expireError });
          return NextResponse.json({ error: "Expired payment session could not be reconciled. Contact support before retrying." }, { status: 503 });
        }
        if (!expiredRows?.length) {
          return NextResponse.json({ error: "Order payment state changed while checking the expired session. Refresh before retrying." }, { status: 409 });
        }
        order.payment_status = "failed";
      }
    }

    let priceDollars = Number(order.final_price || 0);
    if (!priceDollars) {
      const computed = getPrice(
        (order.package || "standard") as PackageType,
        (order.booking_type || "concierge") as BookingType
      );
      priceDollars = computed.finalPrice;
    }
    const priceCents = Math.round(priceDollars * 100);
    if (!Number.isSafeInteger(priceCents) || priceCents <= 0) {
      return NextResponse.json({ error: "Order price is invalid; contact support" }, { status: 409 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const pkgName = ((order.package || "standard") as string).charAt(0).toUpperCase() + ((order.package || "standard") as string).slice(1);
    const vehicleLabel = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;

    const trackParam = order.tracking_token ? `&track=${encodeURIComponent(`/track/${orderId}?t=${order.tracking_token}`)}` : "";

    // TODO: FUTURE_SERVICE_FEE_CENTS = 300 — platform fee placeholder (not charged yet)
    // When enabled, add as a separate line_item with price_data.unit_amount = 300
    // and update priceCents to exclude it from the inspection line so tax is clean.

    const enableStripeTax = process.env.ENABLE_STRIPE_TAX === "true";

    const idempotencyKey = `ridecheck-checkout:${orderId}:${token}:${order.payment_status || "unpaid"}:${linkedSessionId || "first"}`;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      ...(enableStripeTax ? { automatic_tax: { enabled: true } } : {}),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `RideCheck ${pkgName} Assessment`,
              description: vehicleLabel,
            },
            unit_amount: priceCents,
            // tax_behavior must be set to "exclusive" or "inclusive" when automatic_tax is enabled.
            // Defaults to "unspecified" (Stripe uses product/account settings) if ENABLE_STRIPE_TAX is off.
            ...(enableStripeTax ? { tax_behavior: "exclusive" as const } : {}),
          },
          quantity: 1,
        },
      ],
      metadata: {
        order_id: orderId,
        payment_link_token: token,
        customer_email: (order as any).buyer_email || (order as any).customer_email || "",
      },
      // PaymentIntent webhook events need the same server-authored order
      // linkage; never accept order/payment metadata from the browser.
      payment_intent_data: {
        metadata: {
          order_id: orderId,
          payment_link_token: token,
          customer_email: (order as any).buyer_email || (order as any).customer_email || "",
        },
      },
      success_url: `${appUrl}/order/received?orderId=${orderId}&status=paid${trackParam}`,
      cancel_url: `${appUrl}/pay/${orderId}?t=${token}`,
    }, { idempotencyKey });

    const now = new Date().toISOString();
    let updateQuery = supabaseAdmin
      .from("orders")
      .update({
        stripe_session_id:          session.id, // legacy column
        stripe_checkout_session_id: session.id, // canonical column (migration 046)
        payment_status: "pending",
        updated_at: now,
      })
      .eq("id", orderId);
    updateQuery = order.payment_status == null
      ? updateQuery.is("payment_status", null)
      : updateQuery.eq("payment_status", order.payment_status);
    const { data: linkedRows, error: updateError } = await updateQuery.select("id");
    if (updateError) {
      console.error("[Pay Create Session] Stripe session created but order linkage update failed", {
        orderId,
        sessionId: session.id,
        error: updateError,
      });
      return NextResponse.json({ error: "Payment session created but could not be linked to the order. Contact support before retrying." }, { status: 503 });
    }
    if (!linkedRows?.length) {
      return NextResponse.json({ error: "Order payment state changed while starting checkout. Refresh the order before retrying." }, { status: 409 });
    }

    console.log("[Pay Create Session] Session created and saved to order", {
      orderId,
      sessionId: session.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[Pay Create Session Error]", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
