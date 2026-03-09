// app/api/orders/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPrice, type PackageType, type BookingType } from "@/lib/utils/pricing";
import { classifyVehicle } from "@/lib/vehicleClassification";
import { resolveCounty, checkPilotPhase, PILOT_CONFIG } from "@/lib/geo/resolveCounty";
import { z } from "zod";

export const runtime = "nodejs";

const createOrderSchema = z.object({
  vehicle_year: z.number().int().min(1900).max(2030),
  vehicle_make: z.string().min(1).max(100),
  vehicle_model: z.string().min(1).max(100),
  vehicle_description: z.string().max(2000).nullable().optional(),
  listing_url: z.string().url().nullable().optional(),
  vehicle_location: z.string().min(1).max(200),

  seller_name: z.string().max(100).nullable().optional(),
  seller_phone: z.string().max(20).nullable().optional(),

  buyer_phone: z.string().min(7).max(20),
  buyer_email_input: z.string().email().nullable().optional(),

  booking_type: z.enum(["self_arrange", "concierge"]),
  package: z.enum(["standard", "plus", "premium", "exotic", "comprehensive", "test"]).optional(),
  preferred_date: z.string().nullable().optional(),
  vehicle_mileage: z.number().int().min(0).nullable().optional(),
  vehicle_price: z.number().min(0).nullable().optional(),

  inspection_address: z.string().optional(),
  inspection_time_window: z.string().optional(),
  notes_to_inspector: z.string().nullable().optional(),
  vehicle_trim: z.string().nullable().optional(),

  booking_method: z.string().optional(),
  preferred_language: z.string().optional(),
  listing_platform: z.string().nullable().optional(),
  package_tier: z.string().optional(),

  service_zip: z.string().regex(/^\d{5}$/, "ZIP must be 5 digits"),
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

    if (PILOT_CONFIG.enabled) {
      const county = resolveCounty(data.service_zip);

      if (county === "unknown") {
        return NextResponse.json(
          {
            error: "service_unavailable",
            message: "RideCheck is currently available only in Lake County, IL during our pilot. We're expanding soon!",
            allowed_counties: ["lake"],
            state: "IL",
          },
          { status: 409 }
        );
      }

      let totalOrders = 0;
      const countsByCounty: Record<string, number> = {};

      try {
        const { count: totalCount } = await supabaseAdmin
          .from("orders")
          .select("*", { count: "exact", head: true })
          .neq("status", "cancelled");

        totalOrders = totalCount || 0;

        const { data: countRows } = await supabaseAdmin
          .from("orders")
          .select("service_county")
          .neq("status", "cancelled")
          .not("service_county", "is", null);

        if (countRows) {
          for (const row of countRows) {
            const c = row.service_county as string;
            countsByCounty[c] = (countsByCounty[c] || 0) + 1;
          }
        }
      } catch {
        // service_county column may not exist yet — proceed with defaults
      }

      const phaseResult = checkPilotPhase(county, totalOrders, countsByCounty);

      if (!phaseResult.allowed) {
        const messages: Record<string, string> = {
          pilot_capacity_reached: "RideCheck pilot has reached capacity. Join the waitlist for updates!",
          county_locked: `RideCheck is not yet available in ${county} county. We're rolling out in phases: Lake → McHenry → Cook.`,
          county_cap_reached: `RideCheck has reached capacity in ${county} county for now. Check back soon!`,
        };

        return NextResponse.json(
          {
            error: phaseResult.error || "service_unavailable",
            message: messages[phaseResult.error || ""] || "Service unavailable in this area.",
            allowed_counties: phaseResult.allowedCounties,
            current_phase: phaseResult.currentPhase,
            state: "IL",
            ...(phaseResult.unlocks_after_total_orders !== undefined && {
              unlocks_after_total_orders: phaseResult.unlocks_after_total_orders,
            }),
          },
          { status: 409 }
        );
      }
    }

    const supabase = createRouteHandlerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const buyer_email = safeString(data.buyer_email_input || session?.user?.email, "guest@ridecheck.com");
    const buyer_phone = data.buyer_phone;
    const customer_id = session?.user?.id ?? null;

    const isTestPackage = data.package === "test";

    const classification = classifyVehicle({
      make: data.vehicle_make,
      model: data.vehicle_model,
      year: data.vehicle_year,
      mileage: data.vehicle_mileage ?? null,
      askingPrice: data.vehicle_price ?? null,
    });

    const serverPackage = isTestPackage ? "test" : classification.packageTier;
    const basePrice = isTestPackage ? 1 : classification.basePrice;
    const finalPrice = isTestPackage ? 1 : classification.basePrice;
    const discountAmount = 0;

    const tracking_token = crypto.randomUUID();
    const payment_link_token = crypto.randomUUID();

    const insertPayload: Record<string, any> = {
      buyer_email,
      buyer_phone,
      ...(customer_id && { customer_id }),

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

      package: serverPackage,
      preferred_date: data.preferred_date ?? null,

      base_price: basePrice,
      final_price: finalPrice,
      discount_amount: discountAmount,

      tracking_token,
      payment_link_token,
    };

    if (isTestPackage) {
      insertPayload.is_internal_test = true;
      insertPayload.test_run_id = `test-booking-${Date.now()}`;
    }

    try {
      const { error: colErr } = await supabaseAdmin
        .from("orders")
        .select("classification_reason")
        .limit(0);
      if (!colErr) {
        if (classification.modifier) {
          insertPayload.classification_modifier = classification.modifier;
        }
        if (classification.classificationReason) {
          insertPayload.classification_reason = classification.classificationReason;
        }
        if (data.vehicle_mileage) {
          insertPayload.vehicle_mileage = data.vehicle_mileage;
        }
        if (data.vehicle_price) {
          insertPayload.vehicle_price = data.vehicle_price;
        }
      }
    } catch {
      // classification columns not yet migrated (010) — skip storing them
    }

    try {
      const { error: svcErr } = await supabaseAdmin
        .from("orders")
        .select("service_zip")
        .limit(0);
      if (!svcErr) {
        insertPayload.service_zip = data.service_zip;
        insertPayload.service_county = resolveCounty(data.service_zip);
        insertPayload.service_state = "IL";
      }
    } catch {
      // service area columns not yet migrated (007) — skip storing them
    }

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

    try {
      if (buyer_email && buyer_email !== "guest@ridecheck.com") {
        const { orderConfirmationHtml } = await import("@/lib/email/templates/order-confirmation");
        const { sendEmail } = await import("@/lib/notifications/email");
        const pkgLabel = (serverPackage || "standard").charAt(0).toUpperCase() + (serverPackage || "standard").slice(1);
        const confirmHtml = orderConfirmationHtml({
          orderId: order.id,
          customerName: buyer_email.split("@")[0],
          vehicleYear: data.vehicle_year,
          vehicleMake: data.vehicle_make,
          vehicleModel: data.vehicle_model,
          packageName: pkgLabel,
          finalPrice: String(finalPrice),
          bookingType: data.booking_type,
          trackUrl: track_url,
          payUrl,
        });
        await sendEmail({
          to: buyer_email,
          subject: `Your RideCheck Inspection Request - ${vehicleLabel}`,
          html: confirmHtml,
        });
      }
    } catch (confirmErr) {
      console.error("[Order Confirmation Email Error]", confirmErr);
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