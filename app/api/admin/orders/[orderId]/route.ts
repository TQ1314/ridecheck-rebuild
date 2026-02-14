import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;

    const [orderRes, eventsRes, auditRes] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", params.orderId)
        .single(),
      supabaseAdmin
        .from("order_events")
        .select("*")
        .eq("order_id", params.orderId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("audit_log")
        .select("*")
        .eq("resource_type", "order")
        .eq("resource_id", params.orderId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (orderRes.error || !orderRes.data) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let inspector = null;
    if (orderRes.data.assigned_inspector_id) {
      const { data } = await supabaseAdmin
        .from("inspectors")
        .select("*")
        .eq("id", orderRes.data.assigned_inspector_id)
        .single();
      inspector = data;
    }

    return NextResponse.json({
      order: orderRes.data,
      events: eventsRes.data || [],
      audit: auditRes.data || [],
      inspector,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
