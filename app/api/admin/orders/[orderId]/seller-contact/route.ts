import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;

    const { data, error } = await supabaseAdmin
      .from("seller_contact_attempts")
      .select("*")
      .eq("order_id", params.orderId)
      .order("attempt_number", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch attempts" }, { status: 500 });
    }

    const { data: consent, error: consentError } = await supabaseAdmin
      .from("order_events")
      .select("details")
      .eq("order_id", params.orderId)
      .eq("event_type", "seller_consent_reported")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return NextResponse.json({
      attempts: data || [],
      facebook_handoff: (consent as any)?.details?.source === "facebook_marketplace"
        ? (consent as any).details : null,
      ...(consentError ? { facebook_handoff_unavailable: true } : {}),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
