// app/api/orders/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPrice, type PackageType, type BookingType } from "@/lib/utils/pricing";
import { z } from "zod";

export const runtime = "nodejs";

export const createOrderSchema = z.object({
  vehicle_year: z.number().int().min(1900).max(2030),
  vehicle_make: z.string().min(1).max(100),
  vehicle_model: z.string().min(1).max(100),
  vehicle_description: z.string().max(500).nullable().optional(),
  listing_url: z.string().url().nullable().optional(),
  vehicle_location: z.string().min(1).max(200),

  seller_name: z.string().max(100).nullable().optional(),
  seller_phone: z.string().max(20).nullable().optional(),

  buyer_phone: z.string().min(7).max(20),
  buyer_email_input: z.string().email().nullable().optional(),

  booking_type: z.enum(["self_arrange", "concierge"]),
  package: z.enum(["standard", "premium", "comprehensive", "plus"]),
  preferred_date: z.string().nullable().optional(),

  inspection_address: z.string().optional(),
  inspection_time_window: z.string().optional(),
  notes_to_inspector: z.string().nullable().optional(),
  vehicle_trim: z.string().nullable().optional(),

  booking_method: z.string().optional(),
  preferred_language: z.string().optional(),
  listing_platform: z.string().nullable().optional(),
  package_tier: z.string().optional(),
});

function safeString(v: unknown, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function safeNullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const supabase = createRouteHandlerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const buyer_email = safeString(data.buyer_email_input || session?.user?.email, "guest@ridecheck.com");
    const buyer_phone = data.buyer_phone;

    const { basePrice, finalPrice, discountAmount } = getPrice(
      data.package as PackageType,
      data.booking_type as BookingType
    );

    const tracking_token = crypto.randomUUID();
    const payment_link_token = crypto.randomUUID();

    const insertPayload: Record<string, any> = {
      buyer_email,
      buyer_phone,

      booking_type: data.booking_type,
      status: "submitted",
      payment_status: "unpaid",

      vehicle_year: data.vehicle_year,
      vehicle_make: data.vehicle_make,
      vehicle_model: data.vehicle_model,
      vehicle_location: data.vehicle_location,
      vehicle_description: data.vehicle_description ?? null,

      listing_url: data.listing_url ?? null,
      seller_name: data.seller_name ?? null,
      seller_phone: data.seller_phone ?? null,

      package: data.package,
      preferred_date: data.preferred_date ?? null,

      base_price: basePrice,
      final_price: finalPrice,
      discount_amount: discountAmount,

      tracking_token,
      payment_link_token,
    };

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert(insertPayload)
      .select("id, order_number, created_at")
      .single();

    if (error) {
      console.error("[Order Create Error]", error);
      return NextResponse.json(
        {
          error: "Failed to create order",
          debug: {
            code: safeNullableString((error as any)?.code),
            message: safeNullableString((error as any)?.message),
            details: safeNullableString((error as any)?.details),
            hint: safeNullableString((error as any)?.hint),
          },
        },
        { status: 500 }
      );
    }

    const track_url = `/track/${order.id}?t=${tracking_token}`;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const payUrl = `${appUrl}/pay/${order.id}?t=${payment_link_token}`;
    const vehicleLabel = `${data.vehicle_year} ${data.vehicle_make} ${data.vehicle_model}`;

    let paymentChannel: string | null = null;
    try {
      if (buyer_phone) {
        const { sendSMS } = await import("@/lib/notifications/sms");
        const smsResult = await sendSMS({
          to: buyer_phone,
          body: `RideCheck: Confirm your inspection for ${vehicleLabel}. Pay securely here: ${payUrl}`,
        });
        if (smsResult.success) {
          paymentChannel = "sms";
        } else if (buyer_email && buyer_email !== "guest@ridecheck.com") {
          const { sendEmail } = await import("@/lib/notifications/email");
          const emailResult = await sendEmail({
            to: buyer_email,
            subject: "RideCheck payment link for your inspection",
            html: `<p>Hi! Your RideCheck inspection for <strong>${vehicleLabel}</strong> is ready for payment.</p><p>Price: <strong>$${finalPrice}</strong></p><p><a href="${payUrl}" style="display:inline-block;padding:12px 24px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Pay Now</a></p><p>Or copy this link: ${payUrl}</p>`,
          });
          if (emailResult.success) paymentChannel = "email";
        }
      } else if (buyer_email && buyer_email !== "guest@ridecheck.com") {
        const { sendEmail } = await import("@/lib/notifications/email");
        const emailResult = await sendEmail({
          to: buyer_email,
          subject: "RideCheck payment link for your inspection",
          html: `<p>Hi! Your RideCheck inspection for <strong>${vehicleLabel}</strong> is ready for payment.</p><p>Price: <strong>$${finalPrice}</strong></p><p><a href="${payUrl}" style="display:inline-block;padding:12px 24px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Pay Now</a></p><p>Or copy this link: ${payUrl}</p>`,
        });
        if (emailResult.success) paymentChannel = "email";
      }

      if (paymentChannel) {
        await supabaseAdmin
          .from("orders")
          .update({
            payment_link_sent_to: paymentChannel === "sms" ? buyer_phone : buyer_email,
            payment_link_sent_channel: paymentChannel,
            payment_link_sent_at: new Date().toISOString(),
          })
          .eq("id", order.id);
      }
    } catch (linkErr) {
      console.error("[Payment Link Send Error]", linkErr);
    }

    const isDebug =
      process.env.DEBUG_PAYMENT_LINKS === "true" &&
      process.env.NODE_ENV !== "production";

    const response: Record<string, any> = {
      order,
      pricing: {
        basePrice,
        finalPrice,
        discountAmount,
      },
      track_url,
      payment_channel: paymentChannel,
    };

    if (isDebug) {
      response.debug = { payment_url: payUrl, channel: paymentChannel || "none" };
    }

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[Order Create Error]", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}