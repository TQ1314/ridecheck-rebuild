import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const orderId = params.id;
  const t = req.nextUrl.searchParams.get("t");

  if (!t) {
    return NextResponse.json({ error: "Missing tracking token" }, { status: 400 });
    }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(
      [
        "id",
        "order_number",
        "created_at",
        "status",
        "ops_status",
        "payment_status",
        "vehicle_year",
        "vehicle_make",
        "vehicle_model",
        "vehicle_location",
        "preferred_date",
        "booking_type",
        "package",
        "report_url",
        "tracking_token",
      ].join(",")
    )
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Security gate: token must match
  if (order.tracking_token !== t) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Return ONLY what buyers should see
  return NextResponse.json({
    id: order.id,
    order_number: order.order_number,
    created_at: order.created_at,
    status: order.status,
    ops_status: order.ops_status,
    payment_status: order.payment_status,
    vehicle: `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`,
    vehicle_location: order.vehicle_location,
    preferred_date: order.preferred_date,
    booking_type: order.booking_type,
    package: order.package,
    report_url: order.report_url ?? null,
  });
}