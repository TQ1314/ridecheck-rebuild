import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;

    const { data, error } = await supabaseAdmin
      .from("seller_contact_attempts")
      .select("*")
      .eq("order_id", params.orderId)
      .order("attempt_number", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch attempts" }, { status: 500 });
    }

    return NextResponse.json({ attempts: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
