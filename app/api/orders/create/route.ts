import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPrice, type PackageType, type BookingType } from "@/lib/utils/pricing";
import { generateOrderId } from "@/lib/utils/orderId";
import { sendEmail } from "@/lib/email/resend";
import { orderConfirmationHtml } from "@/lib/email/templates/order-confirmation";
import { getStripe } from "@/lib/stripe/server";
import { z } from "zod";

const createOrderSchema = z.object({
  vehicle_year: z.number().int().min(1900).max(2030),
  vehicle_make: z.string().min(1).max(100),
  vehicle_model: z.string().min(1).max(100),
  vehicle_description: z.string().max(500).nullable().optional(),
  listing_url: z.string().url().nullable().optional(),
  vehicle_location: z.string().min(1).max(200),
  seller_name: z.string().max(100).nullable().optional(),
  seller_phone: z.string().max(20).nullable().optional(),
  booking_type: z.enum(["self_arrange", "concierge"]),
  package: z.enum(["standard", "premium", "comprehensive", "plus"]),
  preferred_date: z.string().nullable().optional(),
  booking_method: z.string().optional(),
  preferred_language: z.string().optional(),
  listing_platform: z.string().nullable().optional(),
  package_tier: z.string().optional(),
  inspection_address: z.string().optional(),
  inspection_time_window: z.string().optional(),
  notes_to_inspector: z.string().nullable().optional(),
  vehicle_trim: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const idempotencyKey = req.headers.get("idempotency-key");

    if (idempotencyKey) {
      const { data: existing } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ order: existing });
      }
    }

    const supabase = createRouteHandlerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    let customerName = "Guest";
    let customerEmail = "guest@ridecheck.com";
    let customerPhone: string | null = null;
    let customerId: string | null = null;

    if (session) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (profile) {
        customerName = profile.full_name || session.user.email || "Guest";
        customerEmail = profile.email || session.user.email || "";
        customerPhone = profile.phone || null;
        customerId = profile.id;
      }
    }

    const { basePrice, finalPrice, discountAmount } = getPrice(
      data.package as PackageType,
      data.booking_type as BookingType,
    );

    const orderId = generateOrderId();

    const orderPayload: Record<string, any> = {
      id: orderId,
      customer_id: customerId,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      vehicle_year: data.vehicle_year,
      vehicle_make: data.vehicle_make,
      vehicle_model: data.vehicle_model,
      vehicle_description: data.vehicle_description || null,
      listing_url: data.listing_url || null,
      vehicle_location: data.vehicle_location,
      seller_name: data.seller_name || null,
      seller_phone: data.seller_phone || null,
      booking_type: data.booking_type,
      package: data.package,
      base_price: basePrice,
      discount_amount: discountAmount,
      final_price: finalPrice,
      payment_status: data.booking_type === "concierge" ? "not_requested" : "not_requested",
      status: "submitted",
      preferred_date: data.preferred_date || null,
      idempotency_key: idempotencyKey || null,
    };

    if (data.booking_method) orderPayload.booking_method = data.booking_method;
    if (data.preferred_language) orderPayload.preferred_language = data.preferred_language;
    if (data.listing_platform) orderPayload.listing_platform = data.listing_platform;
    if (data.package_tier) orderPayload.package_tier = data.package_tier;
    if (data.inspection_address) orderPayload.inspection_address = data.inspection_address;
    if (data.inspection_time_window) orderPayload.inspection_time_window = data.inspection_time_window;
    if (data.notes_to_inspector) orderPayload.notes_to_inspector = data.notes_to_inspector;
    if (data.vehicle_trim) orderPayload.vehicle_trim = data.vehicle_trim;

    orderPayload.calculated_price_cents = Math.round(finalPrice * 100);

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert(orderPayload)
      .select()
      .single();

    if (error) {
      console.error("[Order Create Error]", error);
      try {
        await supabaseAdmin.from("orders").update({
          last_error: error.message,
        }).eq("id", orderId);
      } catch (_) {}
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 },
      );
    }

    await supabaseAdmin.from("activity_log").insert({
      user_id: customerId,
      order_id: orderId,
      action: "order_created",
      details: {
        booking_type: data.booking_type,
        package: data.package,
        booking_method: data.booking_method || "concierge",
      },
    });

    if (data.booking_type === "self_arrange") {
      const stripe = getStripe();
      if (stripe) {
        try {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
          const bookingMethod = data.booking_method || "self_arrange";
          const lang = data.preferred_language || "en";
          const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [
              {
                price_data: {
                  currency: "usd",
                  product_data: {
                    name: `RideCheck ${data.package.charAt(0).toUpperCase() + data.package.slice(1)} Assessment`,
                    description: `${data.vehicle_year} ${data.vehicle_make} ${data.vehicle_model}`,
                  },
                  unit_amount: Math.round(finalPrice * 100),
                },
                quantity: 1,
              },
            ],
            metadata: { order_id: orderId },
            success_url: `${appUrl}/order/confirmation?order_id=${orderId}&lang=${lang}&method=${bookingMethod}`,
            cancel_url: `${appUrl}/book`,
          });

          if (session.url) {
            return NextResponse.json({
              order,
              checkout_url: session.url,
            });
          }
        } catch (stripeErr) {
          console.error("[Stripe Checkout Error]", stripeErr);
        }
      }
    }

    sendEmail({
      to: customerEmail,
      subject: `Order Confirmed - ${orderId}`,
      html: orderConfirmationHtml({
        orderId,
        customerName,
        vehicleYear: data.vehicle_year,
        vehicleMake: data.vehicle_make,
        vehicleModel: data.vehicle_model,
        packageName: data.package,
        finalPrice: String(finalPrice),
        bookingType: data.booking_type,
      }),
    }).catch(console.error);

    return NextResponse.json({ order });
  } catch (err: any) {
    console.error("[Order Create Error]", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
