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

  // optional extras (only used if your table has them later)
  inspection_address: z.string().optional(),
  inspection_time_window: z.string().optional(),
  notes_to_inspector: z.string().nullable().optional(),
  vehicle_trim: z.string().nullable().optional(),

  // kept for API compatibility, but we DO NOT store it in DB right now
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

    // Get logged-in session (if any)
    const supabase = createRouteHandlerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Buyer contact (matches your table: buyer_email, buyer_phone)
    // If you have a separate auth flow, session.user.email will be populated.
    const buyer_email = safeString(session?.user?.email, "guest@ridecheck.com");
    const buyer_phone: string | null = null; // set later if you actually collect it in UI

    // Price computed for UI only (NOT stored, because those columns don't exist yet)
    const { basePrice, finalPrice, discountAmount } = getPrice(
      data.package as PackageType,
      data.booking_type as BookingType
    );

    /**
     * IMPORTANT:
     * Only include columns that exist in your Supabase `orders` table.
     * From your screenshots we can safely rely on:
     *  - buyer_email, buyer_phone
     *  - booking_type, status
     *  - listing_url, vehicle_year
     * and your table likely has the rest of these order basics.
     *
     * If ANY of these are missing, Supabase will throw PGRST204 again.
     * If that happens, remove the missing one and retry.
     */
    const insertPayload: Record<string, any> = {
      buyer_email,
      buyer_phone,

      booking_type: data.booking_type, // table shows booking_type
      status: "submitted", // table shows status

      // vehicle
      vehicle_year: data.vehicle_year, // table shows vehicle_year
      vehicle_make: data.vehicle_make,
      vehicle_model: data.vehicle_model,
      vehicle_location: data.vehicle_location,
      vehicle_description: data.vehicle_description ?? null,

      // listing + seller
      listing_url: data.listing_url ?? null, // table shows listing_url
      seller_name: data.seller_name ?? null,
      seller_phone: data.seller_phone ?? null,

      // package / date (very likely in your table)
      package: data.package,
      preferred_date: data.preferred_date ?? null,
    };

    // Insert order
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert(insertPayload)
      .select("*")
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

    // Return order + computed pricing (not stored)
    return NextResponse.json({
      order,
      pricing: {
        basePrice,
        finalPrice,
        discountAmount,
      },
    });
  } catch (err: any) {
    console.error("[Order Create Error]", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

