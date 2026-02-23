import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPrice, type PackageType, type BookingType } from "@/lib/utils/pricing";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");
    const token = searchParams.get("t");

    if (!orderId || !token) {
      return NextResponse.json({ valid: false, error: "Missing parameters" }, { status: 400 });
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, payment_link_token, payment_status, vehicle_year, vehicle_make, vehicle_model, booking_type, package, base_price, final_price, payment_link_click_ip")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ valid: false, error: "Order not found" }, { status: 404 });
    }

    if (!order.payment_link_token || order.payment_link_token !== token) {
      return NextResponse.json({ valid: false, error: "Invalid token" }, { status: 403 });
    }

    if (order.payment_status === "paid") {
      return NextResponse.json({ valid: false, error: "Already paid", paid: true }, { status: 400 });
    }

    let price = Number(order.final_price || 0);
    if (!price) {
      const computed = getPrice(
        (order.package || "standard") as PackageType,
        (order.booking_type || "concierge") as BookingType
      );
      price = computed.finalPrice;
    }

    if (!order.payment_link_click_ip) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
      const ua = req.headers.get("user-agent") || null;
      if (ip || ua) {
        await supabaseAdmin
          .from("orders")
          .update({
            payment_link_click_ip: ip,
            payment_link_click_ua: ua,
          })
          .eq("id", orderId);
      }
    }

    return NextResponse.json({
      valid: true,
      order: {
        id: order.id,
        vehicle_year: order.vehicle_year,
        vehicle_make: order.vehicle_make,
        vehicle_model: order.vehicle_model,
        booking_type: order.booking_type,
        package: order.package,
      },
      price,
    });
  } catch (err: any) {
    console.error("[Pay Validate Error]", err);
    return NextResponse.json({ valid: false, error: "Internal error" }, { status: 500 });
  }
}
