import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await requireRole(["inspector", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const { data: inspector } = await supabaseAdmin
      .from("inspectors")
      .select("id")
      .eq("user_id", actor.userId)
      .maybeSingle();

    if (!inspector && actor.role !== "owner") {
      return NextResponse.json({ error: "Inspector profile not found" }, { status: 404 });
    }

    let query = supabaseAdmin
      .from("orders")
      .select("id, order_id, vehicle_year, vehicle_make, vehicle_model, vehicle_vin, package, scheduled_date, scheduled_time, inspection_address, inspector_status, report_status, ops_status, created_at")
      .not("assigned_inspector_id", "is", null);

    if (actor.role !== "owner" && inspector) {
      query = query.eq("assigned_inspector_id", inspector.id);
    }

    const { data: jobs, error } = await query
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Inspector jobs fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
    }

    return NextResponse.json({ jobs: jobs || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
