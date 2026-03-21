import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await requireRole(["qa", "owner"]);
    if (!isAuthorized(result)) return result.error;

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_id, vehicle_year, vehicle_make, vehicle_model, package, report_status, report_uploaded_at, qa_status, qa_notes, inspector_status, created_at")
      .in("report_status", ["uploaded", "in_review", "revision_needed", "approved"])
      .order("report_uploaded_at", { ascending: true, nullsFirst: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch orders for QA" }, { status: 500 });
    }

    return NextResponse.json({ orders: orders || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
