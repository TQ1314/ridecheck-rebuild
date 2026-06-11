/**
 * GET /api/admin/orders/[orderId]/generated-report
 *
 * Returns the latest generated_reports row for the order.
 * Falls back to a synthetic object built from orders table data
 * for orders generated before the generated_reports table existed
 * (backward compatibility — flagged with isLegacy: true).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops", "qa_reviewer"]);
    if (!isAuthorized(result)) return result.error;

    // Fetch the most-recent active (non-superseded) generated_reports row
    const { data: genReport } = await supabaseAdmin
      .from("generated_reports")
      .select("*")
      .eq("order_id", params.orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (genReport) {
      return NextResponse.json({ report: genReport, isLegacy: false });
    }

    // ── Backward-compatibility: build a synthetic row from orders data ──
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_id, customer_email, buyer_email, customer_name, vehicle_year, vehicle_make, vehicle_model, report_storage_path, ops_report_url, report_status, report_delivered_at, report_logic_version"
      )
      .eq("id", params.orderId)
      .single();

    if (!order) {
      return NextResponse.json({ report: null, isLegacy: false });
    }

    const hasReport = !!order.report_storage_path || !!order.ops_report_url;
    if (!hasReport) {
      return NextResponse.json({ report: null, isLegacy: false });
    }

    // Map orders.report_status → generated_reports.report_status
    const legacyStatusMap: Record<string, string> = {
      approved:     "qa_approved",
      generated:    "qa_approved",
      report_ready: "qa_approved",
      delivered:    "delivered",
      in_review:    "qa_pending",
      sent:         "delivered",
    };

    const synthetic = {
      id:                  null as null,
      order_id:            order.id,
      order_number:        (order as any).order_id,
      buyer_email:         (order as any).buyer_email || order.customer_email,
      buyer_name:          order.customer_name,
      vehicle_year:        String(order.vehicle_year),
      vehicle_make:        order.vehicle_make,
      vehicle_model:       order.vehicle_model,
      vin:                 null as null,
      report_storage_path: order.report_storage_path,
      report_url:          order.ops_report_url,
      report_status:       legacyStatusMap[(order as any).report_status ?? ""] ?? "qa_pending",
      generated_by:        null as null,
      qa_approved_by:      null as null,
      qa_approved_at:      null as null,
      qa_notes:            null as null,
      delivered_by:        null as null,
      delivered_at:        (order as any).report_delivered_at ?? null,
      report_logic_version: (order as any).report_logic_version ?? null,
      created_at:          null as null,
      updated_at:          null as null,
    };

    return NextResponse.json({ report: synthetic, isLegacy: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
