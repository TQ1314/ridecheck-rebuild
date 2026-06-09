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
      .select("id, payment_link_token, payment_status, vehicle_year, vehicle_make, vehicle_model, booking_type, package, base_price, final_price, tracking_token, buyer_email, customer_email")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.payment_link_token || order.payment_link_token !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    if (order.payment_status === "paid") {
      return NextResponse.json({ error: "Already paid" }, { status: 400 });
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const pkgName = ((order.package || "standard") as string).charAt(0).toUpperCase() + ((order.package || "standard") as string).slice(1);
    const vehicleLabel = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;

    const trackParam = order.tracking_token ? `&track=${encodeURIComponent(`/track/${orderId}?t=${order.tracking_token}`)}` : "";

    // TODO: FUTURE_SERVICE_FEE_CENTS = 300 — platform fee placeholder (not charged yet)
    // When enabled, add as a separate line_item with price_data.unit_amount = 300
    // and update priceCents to exclude it from the inspection line so tax is clean.

    const enableStripeTax = process.env.ENABLE_STRIPE_TAX === "true";

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
      success_url: `${appUrl}/order/received?orderId=${orderId}&status=paid${trackParam}`,
      cancel_url: `${appUrl}/pay/${orderId}?t=${token}`,
    });

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("orders")
      .update({
        stripe_session_id:          session.id, // legacy column
        stripe_checkout_session_id: session.id, // canonical column (migration 046)
        payment_status: "pending",
        updated_at: now,
      })
      .eq("id", orderId);

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
