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

    const buyer_email = safeString(session?.user?.email, "guest@ridecheck.com");
    const buyer_phone: string | null = null;

    const { basePrice, finalPrice, discountAmount } = getPrice(
      data.package as PackageType,
      data.booking_type as BookingType
    );

    // 🔐 Generate tracking token for public status page
    const tracking_token = crypto.randomUUID();

    const insertPayload: Record<string, any> = {
      buyer_email,
      buyer_phone,

      booking_type: data.booking_type,
      status: "submitted",

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

      // 👇 NEW COLUMN (must exist in DB)
      tracking_token,
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

    return NextResponse.json({
      order,
      pricing: {
        basePrice,
        finalPrice,
        discountAmount,
      },
      track_url, // 👈 front-end will use this instead of dashboard
    });
  } catch (err: any) {
    console.error("[Order Create Error]", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}