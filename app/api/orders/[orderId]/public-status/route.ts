// app/api/orders/[orderId]/public-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const t = searchParams.get("t");

    if (!t) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        order_number,
        status,
        ops_status,
        created_at,
        preferred_date,
        package,
        booking_type,
        vehicle_year,
        vehicle_make,
        vehicle_model,
        vehicle_location,
        tracking_token
      `
      )
      .eq("id", params.orderId)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Token check
    if (!order.tracking_token || order.tracking_token !== t) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Never return tracking_token to the client
    const { tracking_token, ...safe } = order as any;

    return NextResponse.json({ order: safe });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}