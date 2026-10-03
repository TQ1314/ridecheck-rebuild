// app/api/orders/[orderId]/public-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_FIELDS = [
  "id",
  "order_number",
  "status",
  "ops_status",
  "created_at",
  "preferred_date",
  "package",
  "booking_type",
  "listing_source",
  "platform_source",
  "payment_status",
  "vehicle_year",
  "vehicle_make",
  "vehicle_model",
  "vehicle_location",
  "tracking_token",
];

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const t = searchParams.get("t");

    if (!t) {
      return NextResponse.json(
        { error: "Missing tracking token. Please use the full tracking link from your confirmation email." },
        { status: 400 }
      );
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(SAFE_FIELDS.join(","))
      .eq("id", params.orderId)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!(order as any).tracking_token || (order as any).tracking_token !== t) {
      return NextResponse.json({ error: "Invalid tracking token" }, { status: 403 });
    }

    const { tracking_token, ...safe } = order as any;
    if (safe.platform_source === "facebook_marketplace") {
      const { data: consent } = await supabaseAdmin.from("order_events").select("details")
        .eq("order_id", params.orderId).eq("event_type", "seller_consent_reported")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      safe.facebook_consent_reported = (consent as any)?.details?.source === "facebook_marketplace"
        && (consent as any)?.details?.seller_consent_reported === true;
    }
    return NextResponse.json({ order: safe, verified: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
