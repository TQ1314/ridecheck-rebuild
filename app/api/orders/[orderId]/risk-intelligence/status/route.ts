import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { canProceedWithRideCheck, PAYMENT_GATE_ERRORS } from "@/lib/payment/payment-gate";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Lightweight status check — returns whether risk intelligence has been run
 * and what the composite result is.  Used by the Ops order detail panel
 * and QC review page to render a status indicator without fetching all sub-checks.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole([
      "operations", "operations_lead", "ops_lead", "admin", "owner", "ops",
      "qa", "qa_reviewer",
    ]);
    if (!isAuthorized(result)) return result.error;

    // Payment gate
    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status, payment_required, payment_override_approved")
      .eq("id", params.orderId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!canProceedWithRideCheck(order)) {
      return NextResponse.json(
        { error: PAYMENT_GATE_ERRORS.report_generation },
        { status: 402 }
      );
    }

    const { data: riskCheck } = await supabaseAdmin
      .from("vehicle_risk_checks")
      .select("id, overall_risk_score, overall_risk_level, score_reasons, updated_at")
      .eq("order_id", params.orderId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!riskCheck) {
      return NextResponse.json({
        completed:     false,
        overall_score: null,
        overall_level: null,
        reasons:       [],
        last_run_at:   null,
      });
    }

    // Check completeness: verify all sub-checks have records
    const [vin, recall, flood, theft, market] = await Promise.all([
      supabaseAdmin.from("vehicle_vin_checks").select("id").eq("order_id", params.orderId).limit(1).maybeSingle(),
      supabaseAdmin.from("vehicle_recall_checks").select("id").eq("order_id", params.orderId).limit(1).maybeSingle(),
      supabaseAdmin.from("vehicle_flood_checks").select("id").eq("order_id", params.orderId).limit(1).maybeSingle(),
      supabaseAdmin.from("vehicle_theft_checks").select("id").eq("order_id", params.orderId).limit(1).maybeSingle(),
      supabaseAdmin.from("vehicle_market_value_checks").select("id").eq("order_id", params.orderId).limit(1).maybeSingle(),
    ]);

    const modules = {
      vin:          !!vin.data,
      recall:       !!recall.data,
      flood:        !!flood.data,
      theft:        !!theft.data,
      market_value: !!market.data,
    };

    const allComplete = Object.values(modules).every(Boolean);

    return NextResponse.json({
      completed:     allComplete,
      overall_score: riskCheck.overall_risk_score,
      overall_level: riskCheck.overall_risk_level,
      reasons:       riskCheck.score_reasons ?? [],
      modules,
      last_run_at:   riskCheck.updated_at,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch status";
    console.error("[risk-intelligence/status]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
