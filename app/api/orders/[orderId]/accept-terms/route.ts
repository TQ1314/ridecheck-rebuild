import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import { TERMS_VERSION, INSPECTION_SCOPE_VERSION } from "@/lib/legal/constants";

export const runtime = "nodejs";

function hashIp(ip: string | null): string {
  return createHash("sha256")
    .update(ip || "unknown")
    .digest("hex");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    const { accepted, buyerEmail, userAgent } = body;

    if (accepted !== true) {
      return NextResponse.json(
        { error: "Terms must be explicitly accepted" },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, terms_accepted, buyer_email")
      .eq("id", params.orderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const acceptance = {
      order_id: params.orderId,
      buyer_email: buyerEmail || order.buyer_email || null,
      terms_version: TERMS_VERSION,
      inspection_scope_version: INSPECTION_SCOPE_VERSION,
      accepted_at: new Date().toISOString(),
      hashed_ip: hashIp(ip),
      user_agent: userAgent || req.headers.get("user-agent") || "unknown",
    };

    const { error: insertError } = await supabaseAdmin
      .from("terms_acceptances")
      .insert(acceptance);

    if (insertError) {
      console.error("[accept-terms] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to record terms acceptance" },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("orders")
      .update({ terms_accepted: true, updated_at: new Date().toISOString() })
      .eq("id", params.orderId);

    return NextResponse.json({
      ok: true,
      termsVersion: TERMS_VERSION,
      inspectionScopeVersion: INSPECTION_SCOPE_VERSION,
      acceptedAt: acceptance.accepted_at,
    });
  } catch (err: any) {
    console.error("[accept-terms]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
