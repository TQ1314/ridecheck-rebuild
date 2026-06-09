import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;

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
