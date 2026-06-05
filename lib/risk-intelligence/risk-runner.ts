import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canProceedWithRideCheck, type PaymentGateOrder } from "@/lib/payment/payment-gate";
import { runVinDecode } from "./vin-decode";
import { runRecallCheck } from "./recall-check";
import { runFloodRisk } from "./flood-risk";
import { runTheftCheck } from "./theft-check";
import { runMarketValueCheck } from "./market-value";
import { computeRiskScore } from "./risk-score";
import type { RiskIntelligenceRunResult } from "./types";

export async function runRiskIntelligence(orderId: string): Promise<RiskIntelligenceRunResult> {
  // ── 1. Load order ──────────────────────────────────────────────────────────
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select(
      "id, vehicle_year, vehicle_make, vehicle_model, vehicle_mileage, vehicle_price, " +
      "payment_status, payment_required, payment_override_approved"
    )
    .eq("id", orderId)
    .single();

  if (orderError || !order) throw new Error("Order not found");

  const o = order as unknown as {
    id: string;
    vehicle_year: number | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vehicle_mileage: number | null;
    vehicle_price: number | null;
    payment_status: string | null;
    payment_required: boolean | null;
    payment_override_approved: boolean | null;
  };

  // ── 2. Payment gate ────────────────────────────────────────────────────────
  if (!canProceedWithRideCheck(o)) {
    throw new Error("Payment required before running risk intelligence.");
  }

  // ── 3. Load latest RideChecker submission (VIN + flood + OBD) ──────────────
  const { data: submission } = await supabaseAdmin
    .from("ridechecker_raw_submissions")
    .select("vin, title_history_module, obd_module")
    .eq("order_id", orderId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const vin = (submission?.vin as string | null) ?? null;
  const thf = (submission?.title_history_module as Record<string, unknown> | null) ?? null;
  const obd = (submission?.obd_module as Record<string, unknown> | null) ?? null;

  // Detect VIN mismatch from title history module
  const vinMismatch =
    (thf?.vins_matched as string | undefined) === "no_discrepancy" ? true : false;

  // Detect OBD safety codes
  const hasOBDSafetyCodes =
    Array.isArray(obd?.dtc_codes) && (obd!.dtc_codes as unknown[]).length > 0;

  const now = new Date().toISOString();

  // ── 4–7. Run VIN decode, theft, market value in parallel ───────────────────
  const [vinResult, theftResult, marketResult] = await Promise.all([
    runVinDecode(vin ?? ""),
    runTheftCheck(vin ?? ""),
    runMarketValueCheck({
      year:         String(o.vehicle_year  ?? ""),
      make:         o.vehicle_make         ?? "",
      model:        o.vehicle_model        ?? "",
      mileage:      o.vehicle_mileage      ?? undefined,
      listingPrice: o.vehicle_price        ?? undefined,
    }),
  ]);

  // ── 5. Recall check (needs make/model/year — prefer order data, fallback to decoded) ─
  const recallMake  = o.vehicle_make  || vinResult.make  || "";
  const recallModel = o.vehicle_model || vinResult.model || "";
  const recallYear  = String(o.vehicle_year ?? vinResult.year ?? "");
  const recallResult = await runRecallCheck(vin ?? "", recallMake, recallModel, recallYear);

  // ── 8. Flood risk (pure function, no I/O) ──────────────────────────────────
  const floodIndicators = thf?.flood_indicators as string[] | null | undefined;
  const floodResult = runFloodRisk(floodIndicators);

  // ── 9. Composite risk score ────────────────────────────────────────────────
  const { score, level, reasons, hardStops } = computeRiskScore({
    vinResult,
    recallResult,
    floodResult,
    theftResult,
    marketValueResult: marketResult,
    vinMismatch,
    hasOBDSafetyCodes,
  });

  // ── 10. Persist all results ────────────────────────────────────────────────
  const vinStored = vin ?? vinResult.vin ?? null;

  // Upsert main check record (unique on order_id — stores only the latest run)
  const { data: riskCheck, error: riskErr } = await supabaseAdmin
    .from("vehicle_risk_checks")
    .upsert(
      {
        order_id:           orderId,
        vin:                vinStored,
        overall_risk_score: score,
        overall_risk_level: level,
        score_reasons:      reasons,
        updated_at:         now,
      },
      { onConflict: "order_id" }
    )
    .select("id")
    .single();

  if (riskErr || !riskCheck) {
    throw new Error(`Failed to save risk check: ${riskErr?.message ?? "unknown"}`);
  }

  // Insert sub-check records (one per run — retains history)
  await Promise.allSettled([
    supabaseAdmin.from("vehicle_vin_checks").insert({
      order_id:      orderId,
      vin:           vinStored,
      decoded_year:  vinResult.year,
      decoded_make:  vinResult.make,
      decoded_model: vinResult.model,
      vin_valid:     vinResult.vinValid,
      source:        vinResult.source,
      raw_response:  (vinResult.rawResponse ?? null) as Record<string, unknown> | null,
      checked_at:    now,
    }),
    supabaseAdmin.from("vehicle_recall_checks").insert({
      order_id:         orderId,
      vin:              vinStored,
      recall_count:     recallResult.recallCount,
      highest_severity: recallResult.highestSeverity,
      recall_data:      recallResult.recalls as unknown as Record<string, unknown>[],
      source:           recallResult.source,
      checked_at:       now,
    }),
    supabaseAdmin.from("vehicle_flood_checks").insert({
      order_id:         orderId,
      flood_risk_score: floodResult.floodRiskScore,
      flood_risk_level: floodResult.floodRiskLevel,
      findings:         floodResult.findings as Record<string, unknown>,
      checked_at:       now,
    }),
    supabaseAdmin.from("vehicle_theft_checks").insert({
      order_id:     orderId,
      theft_status: theftResult.status,
      theft_source: theftResult.source,
      theft_data:   (theftResult.findings ?? null) as Record<string, unknown> | null,
      checked_at:   now,
    }),
    supabaseAdmin.from("vehicle_market_value_checks").insert({
      order_id:               orderId,
      listing_price:          marketResult.listingPrice,
      estimated_market_value: marketResult.estimatedMarketValue,
      variance_percent:       marketResult.variancePercent,
      pricing_risk_level:     marketResult.pricingRiskLevel,
      source:                 marketResult.source,
      checked_at:             now,
    }),
  ]);

  return {
    orderId,
    riskCheckId:  riskCheck.id,
    vin:          vinStored,
    overallScore: score,
    overallLevel: level,
    reasons,
    hardStops,
    vin_check:    vinResult,
    recall_check: recallResult,
    flood_check:  floodResult,
    theft_check:  theftResult,
    market_check: marketResult,
    completed_at: now,
  };
}
