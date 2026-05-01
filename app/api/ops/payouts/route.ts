import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// GET — list all payouts with optional status filter
export async function GET(req: NextRequest) {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;

    const { searchParams } = new URL(req.url);
    const status   = searchParams.get("status");
    const batchId  = searchParams.get("batch_id");
    const limit    = parseInt(searchParams.get("limit") ?? "100", 10);
    const offset   = parseInt(searchParams.get("offset") ?? "0", 10);

    let query = supabaseAdmin
      .from("ridechecker_payouts")
      .select(`
        *,
        rc_profile:profiles!ridechecker_id (full_name, email),
        order:orders!order_id (vehicle_year, vehicle_make, vehicle_model)
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status)  query = query.eq("status", status);
    if (batchId) query = query.eq("payout_batch_id", batchId);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch payouts" }, { status: 500 });
    }

    const payouts = (data ?? []).map((p: any) => ({
      ...p,
      ridechecker_name:  p.rc_profile?.full_name  ?? null,
      ridechecker_email: p.rc_profile?.email       ?? null,
      vehicle_label: p.order
        ? [p.order.vehicle_year, p.order.vehicle_make, p.order.vehicle_model].filter(Boolean).join(" ")
        : null,
      rc_profile: undefined,
      order: undefined,
    }));

    // Summary totals
    const { data: totals } = await supabaseAdmin
      .from("ridechecker_payouts")
      .select("status, total_pay");

    const summary = { pending: 0, approved: 0, paid: 0, pending_count: 0, approved_count: 0 };
    for (const row of totals ?? []) {
      if (row.status === "pending") {
        summary.pending += row.total_pay ?? 0;
        summary.pending_count++;
      }
      if (row.status === "approved") {
        summary.approved += row.total_pay ?? 0;
        summary.approved_count++;
      }
    }

    return NextResponse.json({ payouts, summary, total: count ?? payouts.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
