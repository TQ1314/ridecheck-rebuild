import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  if (!params.sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const { data: credit, error } = await supabaseAdmin
    .from("ridecheck_credits")
    .select(
      "id, tier, amount_cents, credits_count, credit_code, supporter_name, supporter_email, gift_recipient_name, gift_recipient_email, list_on_partners_page, status, expires_at, created_at"
    )
    .eq("stripe_session_id", params.sessionId)
    .maybeSingle();

  if (error) {
    console.error("[founding/session]", error);
    return NextResponse.json({ error: "Failed to load credit" }, { status: 500 });
  }

  if (!credit) {
    return NextResponse.json({ credit: null }, { status: 404 });
  }

  return NextResponse.json({ credit });
}
