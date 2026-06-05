import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { canProceedWithRideCheck, PAYMENT_GATE_ERRORS } from "@/lib/payment/payment-gate";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

    // Fetch all risk checks in parallel (latest record per table)
    const [riskCheck, vinCheck, recallCheck, floodCheck, theftCheck, marketCheck] =
      await Promise.all([
        supabaseAdmin
          .from("vehicle_risk_checks")
          .select("*")
          .eq("order_id", params.orderId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("vehicle_vin_checks")
          .select("*")
          .eq("order_id", params.orderId)
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("vehicle_recall_checks")
          .select("*")
          .eq("order_id", params.orderId)
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("vehicle_flood_checks")
          .select("*")
          .eq("order_id", params.orderId)
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("vehicle_theft_checks")
          .select("*")
          .eq("order_id", params.orderId)
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("vehicle_market_value_checks")
          .select("*")
          .eq("order_id", params.orderId)
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (!riskCheck.data) {
      return NextResponse.json(
        { exists: false, message: "Risk intelligence has not been run for this order." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      exists: true,
      risk_check:    riskCheck.data,
      vin_check:     vinCheck.data    ?? null,
      recall_check:  recallCheck.data ?? null,
      flood_check:   floodCheck.data  ?? null,
      theft_check:   theftCheck.data  ?? null,
      market_check:  marketCheck.data ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch risk intelligence";
    console.error("[risk-intelligence GET]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
