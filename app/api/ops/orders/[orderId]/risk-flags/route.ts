import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const result = await requireRole(["owner", "operations_lead", "ops_lead", "operations", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const body = await req.json().catch(() => ({}));
  const { risk_flags } = body;

  if (!risk_flags || typeof risk_flags !== "object") {
    return NextResponse.json({ error: "risk_flags must be an object" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("orders")
    .update({ risk_flags, updated_at: new Date().toISOString() })
    .eq("id", params.orderId);

  if (error) {
    console.error("[risk-flags patch error]", error);
    return NextResponse.json({ error: "Failed to save flags" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
