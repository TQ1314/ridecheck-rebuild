import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify order belongs to this buyer
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, customer_id")
      .eq("id", params.orderId)
      .eq("customer_id", session.user.id)
      .maybeSingle();

    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: credit } = await supabaseAdmin
      .from("transferable_order_credit")
      .select("*")
      .eq("original_order_id", params.orderId)
      .maybeSingle();

    return NextResponse.json({ credit: credit ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
