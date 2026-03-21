import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TIER_PRICES } from "@/lib/vehicleClassification";
import type { VehicleTier } from "@/lib/vehicleClassification";

const ALLOWED_OVERRIDES = ["standard", "plus", "exotic"] as const;
type OverrideTier = typeof ALLOWED_OVERRIDES[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  const role = profile.data?.role;
  if (!["admin", "operations"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { package_override, package_override_reason } = body;

  if (!ALLOWED_OVERRIDES.includes(package_override)) {
    return NextResponse.json(
      { error: "Invalid package. Must be one of: standard, plus, exotic" },
      { status: 400 }
    );
  }

  const overrideTier = package_override as OverrideTier;
  const overridePrice = TIER_PRICES[overrideTier as VehicleTier];

  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select("id, classification_reason")
    .eq("id", params.orderId)
    .single();

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const systemReason = order.classification_reason || "System classification";
  const overrideNote = package_override_reason
    ? `[OPS OVERRIDE: ${package_override_reason}] ${systemReason}`
    : `[OPS OVERRIDE by ${session.user.id.slice(0, 8)}] ${systemReason}`;

  const updatePayload: Record<string, unknown> = {
    package: package_override,
    base_price: overridePrice,
    final_price: overridePrice,
    classification_reason: overrideNote,
    classification_modifier: "ops_override",
  };

  const { error: updateErr } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", params.orderId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, package: package_override, price: overridePrice });
}
