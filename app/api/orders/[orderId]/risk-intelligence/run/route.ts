import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { canProceedWithRideCheck, PAYMENT_GATE_ERRORS } from "@/lib/payment/payment-gate";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runRiskIntelligence } from "@/lib/risk-intelligence/risk-runner";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole([
      "operations", "operations_lead", "ops_lead", "admin", "owner", "ops",
    ]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    // Verify order exists and payment is authorized before delegating to runner
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

    // Run the full risk intelligence pipeline
    const intelligence = await runRiskIntelligence(params.orderId);

    // Audit trail
    await Promise.allSettled([
      writeOrderEvent({
        orderId:    params.orderId,
        eventType:  "risk_intelligence_run",
        actorId:    actor.userId,
        actorEmail: actor.email,
        details: {
          overall_score: intelligence.overallScore,
          overall_level: intelligence.overallLevel,
          recall_count:  intelligence.recall_check.recallCount,
          flood_level:   intelligence.flood_check.floodRiskLevel,
          theft_status:  intelligence.theft_check.status,
          hard_stops:    intelligence.hardStops,
        },
        isInternal: true,
      }),
      writeAuditLog({
        actorId:    actor.userId,
        actorEmail: actor.email,
        actorRole:  actor.role,
        action:     "order.risk_intelligence_run",
        resourceId: params.orderId,
        newValue: {
          risk_check_id: intelligence.riskCheckId,
          score:         intelligence.overallScore,
          level:         intelligence.overallLevel,
        },
      }),
    ]);

    return NextResponse.json({
      success:       true,
      risk_check_id: intelligence.riskCheckId,
      overall_score: intelligence.overallScore,
      overall_level: intelligence.overallLevel,
      reasons:       intelligence.reasons,
      hard_stops:    intelligence.hardStops,
      modules: {
        vin: {
          vin_valid:  intelligence.vin_check.vinValid,
          year:       intelligence.vin_check.year,
          make:       intelligence.vin_check.make,
          model:      intelligence.vin_check.model,
          error:      intelligence.vin_check.error ?? null,
        },
        recalls: {
          recall_count:     intelligence.recall_check.recallCount,
          highest_severity: intelligence.recall_check.highestSeverity,
          recalls:          intelligence.recall_check.recalls,
          error:            intelligence.recall_check.error ?? null,
        },
        flood: {
          score:               intelligence.flood_check.floodRiskScore,
          level:               intelligence.flood_check.floodRiskLevel,
          active_indicators:   intelligence.flood_check.activeIndicators,
        },
        theft: {
          status: intelligence.theft_check.status,
          source: intelligence.theft_check.source,
        },
        market_value: {
          listing_price:   intelligence.market_check.listingPrice,
          estimated_value: intelligence.market_check.estimatedMarketValue,
          variance_pct:    intelligence.market_check.variancePercent,
          risk_level:      intelligence.market_check.pricingRiskLevel,
          source:          intelligence.market_check.source,
        },
      },
      completed_at: intelligence.completed_at,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Risk intelligence run failed";
    console.error("[risk-intelligence/run]", msg);
    const status = msg.includes("Payment required") ? 402 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
