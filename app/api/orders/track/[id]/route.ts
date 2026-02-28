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

  const o = order as any;

  if (o.tracking_token !== t) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: o.id,
    order_number: o.order_number,
    created_at: o.created_at,
    status: o.status,
    ops_status: o.ops_status,
    payment_status: o.payment_status,
    vehicle: `${o.vehicle_year} ${o.vehicle_make} ${o.vehicle_model}`,
    vehicle_location: o.vehicle_location,
    preferred_date: o.preferred_date,
    booking_type: o.booking_type,
    package: o.package,
    report_url: o.report_url ?? null,
  });
}