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
        .from("profiles")
        .select("id, full_name, email, phone, service_area, role, ridechecker_max_daily_jobs, ridechecker_rating")
        .eq("id", orderRes.data.assigned_inspector_id)
        .single();
      if (data) {
        inspector = {
          id: data.id,
          full_name: data.full_name || "Unknown",
          email: data.email,
          phone: data.phone,
          region: data.service_area,
          is_active: data.role === "ridechecker_active",
          max_daily_capacity: data.ridechecker_max_daily_jobs ?? 5,
          rating: data.ridechecker_rating,
        };
      }
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
