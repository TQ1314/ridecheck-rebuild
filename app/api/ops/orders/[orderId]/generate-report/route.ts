import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canProceedWithRideCheck, PAYMENT_GATE_ERRORS } from "@/lib/payment/payment-gate";
import { generateReportWithClaude } from "@/lib/report/claude-generate";
import { REPORT_LOGIC_VERSION } from "@/lib/report/report-version";
import type { ReportInput, ReportMeta, ScopeRow, ConfidenceLevel, OBDModule, TitleHistoryModule } from "@/lib/report/types";
import { validatePhotos, partitionResults } from "@/lib/report/photo-validator";
import React from "react";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function resolveOBDScope(submission: any): { level: string; status: ScopeRow["status"] } {
  const obd = submission.obd_module as OBDModule | null | undefined;
  if (obd) {
    switch (obd.scan_performed) {
      case "yes": {
        const hasCodes   = (obd.dtc_codes?.length ?? 0) > 0;
        const hasFiles   = (obd.uploaded_files?.length ?? 0) > 0;
        const hasEvidence = hasCodes || hasFiles;
        return {
          level:  hasEvidence ? "Performed — Codes + Evidence Uploaded" : "Performed",
          status: "assessed",
        };
      }
      case "no":            return { level: "Not Performed",                        status: "not_assessed" };
      case "not_available": return { level: "Not Available — Scanner Issue",        status: "not_assessed" };
      case "not_permitted": return { level: "Not Permitted by Seller",              status: "not_assessed" };
    }
  }
  // Legacy fallback — plain scan_codes
  const hasLegacyCodes = Array.isArray(submission.scan_codes) && submission.scan_codes.length > 0;
  return {
    level:  hasLegacyCodes ? "Full Scan Performed" : "Not Performed",
    status: hasLegacyCodes ? "assessed" : "not_assessed",
  };
}

function buildScopeTable(submission: any): ScopeRow[] {
  const obdScope      = resolveOBDScope(submission);
  const hasOBD        = obdScope.status === "assessed";
  const hasUndercarriage = !!submission.undercarriage_photo_url;
  const hasBrakes = !!(submission.brake_condition && submission.brake_condition.trim().length > 0);
  const hasTread = [
    submission.tire_tread_mm_front_left,
    submission.tire_tread_mm_front_right,
    submission.tire_tread_mm_rear_left,
    submission.tire_tread_mm_rear_right,
  ].some((v) => v != null);

  const rtModule = submission.road_test_module as { status?: string } | null | undefined;
  const rtStatus = rtModule?.status;

  let roadTestLevel: string;
  let roadTestScopeStatus: ScopeRow["status"];
  let transmissionLevel: string;

  if (rtStatus === "completed") {
    roadTestLevel       = "Completed";
    roadTestScopeStatus = "assessed";
    transmissionLevel   = "Road Test Observed";
  } else if (rtStatus === "not_permitted") {
    roadTestLevel       = "Not Permitted by Seller";
    roadTestScopeStatus = "not_assessed";
    transmissionLevel   = "Visual Only";
  } else if (rtStatus === "not_possible") {
    roadTestLevel       = "Not Possible — Location/Condition";
    roadTestScopeStatus = "not_assessed";
    transmissionLevel   = "Visual Only";
  } else {
    const hasNotes = !!(submission.test_drive_notes && submission.test_drive_notes.trim().length > 10);
    roadTestLevel       = hasNotes ? "Completed" : "Not Performed";
    roadTestScopeStatus = hasNotes ? "assessed" : "not_assessed";
    transmissionLevel   = hasNotes ? "Road Test Observed" : "Visual Only";
  }

  return [
    { system: "Engine",            level: hasOBD           ? "Visual + OBD Scan"       : "Visual Only",  status: hasOBD           ? "assessed"     : "partial"      },
    { system: "OBD Scan",          level: obdScope.level,                                                status: obdScope.status                                     },
    { system: "Frame / Underbody", level: hasUndercarriage ? "Visual Only"              : "Not Assessed", status: hasUndercarriage ? "partial"      : "not_assessed" },
    { system: "Brakes",            level: hasBrakes        ? "Assessed"                 : "Not Assessed", status: hasBrakes        ? "assessed"     : "not_assessed" },
    { system: "Transmission",      level: transmissionLevel,                                              status: "partial"                                           },
    { system: "Electrical",        level: "Visual Only",                                                  status: "partial"                                           },
    { system: "Tires",             level: hasTread         ? "Visual + Tread Measured"  : "Visual Only",  status: hasTread         ? "assessed"     : "partial"      },
    { system: "Road Test",         level: roadTestLevel,                                                  status: roadTestScopeStatus                                 },
    ...buildTitleScopeRow(submission),
  ];
}

function buildTitleScopeRow(submission: any): ScopeRow[] {
  const thf = submission.title_history_module as TitleHistoryModule | null | undefined;
  if (!thf?.title_review_status) return [];
  switch (thf.title_review_status) {
    case "yes_reviewed":        return [{ system: "Title Review", level: "Physical Title Reviewed",   status: "assessed"     }];
    case "partial":             return [{ system: "Title Review", level: "Partial Review Only",        status: "partial"      }];
    case "no_seller":           return [{ system: "Title Review", level: "Not Provided by Seller",     status: "not_assessed" }];
    case "dealer_unavailable":  return [{ system: "Title Review", level: "Dealer — Not Available",     status: "not_assessed" }];
    case "not_applicable":      return [{ system: "Title Review", level: "Not Applicable",             status: "not_assessed" }];
    default:                    return [{ system: "Title Review", level: thf.title_review_status,      status: "not_assessed" }];
  }
}

function buildMissingItems(submission: any): string[] {
  const items: string[] = [];

  // OBD — prefer structured module, fall back to legacy scan_codes
  const obd = submission.obd_module as OBDModule | null | undefined;
  if (obd) {
    switch (obd.scan_performed) {
      case "no":            items.push("OBD-II diagnostic scan was not performed"); break;
      case "not_available": items.push("OBD-II diagnostic scan could not be completed — scanner or connection issue"); break;
      case "not_permitted": items.push("OBD-II diagnostic scan was not permitted by seller"); break;
      // "yes" → scan performed; no missing item
    }
  } else {
    const hasLegacyCodes = Array.isArray(submission.scan_codes) && submission.scan_codes.length > 0;
    if (!hasLegacyCodes) items.push("No OBD diagnostic codes retrieved");
  }

  if (!submission.undercarriage_photo_url)
    items.push("No lift inspection performed");
  if (!submission.brake_condition || submission.brake_condition.trim().length === 0)
    items.push("Brake system not fully assessed");
  const hasTread = [
    submission.tire_tread_mm_front_left,
    submission.tire_tread_mm_front_right,
    submission.tire_tread_mm_rear_left,
    submission.tire_tread_mm_rear_right,
  ].some((v) => v != null);
  if (!hasTread)
    items.push("Tire tread depth not measured");

  const rtModule = submission.road_test_module as { status?: string } | null | undefined;
  const rtStatus = rtModule?.status;
  if (rtStatus === "not_permitted") {
    items.push("Road test not permitted by seller");
  } else if (rtStatus === "not_possible") {
    items.push("Road test not possible — location or vehicle condition");
  } else if (rtStatus !== "completed") {
    if (!submission.test_drive_notes || submission.test_drive_notes.trim().length <= 10)
      items.push("Road test not performed");
  }

  // Title & History module
  const thf = submission.title_history_module as TitleHistoryModule | null | undefined;
  if (thf) {
    if (thf.title_review_status === "no_seller")
      items.push("Physical title was not available for review at time of inspection");
    if (thf.vin_match_title === "no_mismatch")
      items.push("VIN discrepancy observed during inspection — independent verification recommended before transaction completion");
    if (thf.vins_matched === "no_discrepancy")
      items.push("Physical VIN location discrepancy observed during inspection");
    if (thf.odometer_consistency === "no_discrepancy")
      items.push("Odometer disclosure discrepancy noted during inspection");
    if (thf.lien_status === "lien_no_release")
      items.push("Lien noted during inspection — no lien release document was present");
  }

  return items;
}

function buildConfidenceLevel(submission: any, missingCount: number): ConfidenceLevel {
  const rtModule = submission.road_test_module as { status?: string } | null | undefined;
  const roadTestCompleted = rtModule?.status === "completed";

  const obd = submission.obd_module as OBDModule | null | undefined;
  const obdPerformed  = obd?.scan_performed === "yes";
  const obdHasEvidence = obdPerformed && (
    (obd?.dtc_codes?.length ?? 0) > 0 ||
    (obd?.uploaded_files?.length ?? 0) > 0
  );

  const thf = submission.title_history_module as TitleHistoryModule | null | undefined;
  const thfOpsStatus = thf?.ops_review_status;

  // Severe flag always forces LIMITED CONFIDENCE regardless of other factors
  if (thfOpsStatus === "severe_attention_flag") return "LIMITED CONFIDENCE";

  let effective = missingCount;
  if (roadTestCompleted)  effective = Math.max(0, effective - 1);
  if (obdHasEvidence)     effective = Math.max(0, effective - 1);

  // Title reviewed + VINs matched + no major indicators → confidence boost
  const titleReviewed = thf?.title_review_status === "yes_reviewed";
  const vinsOk = thf?.vins_matched === "yes" && thf?.vin_match_title === "yes";
  const noMajorFlags = !thfOpsStatus || thfOpsStatus === "normal";
  if (titleReviewed && vinsOk && noMajorFlags) effective = Math.max(0, effective - 1);

  // Title unavailable or VIN issues → confidence penalty
  if (thfOpsStatus === "ops_review_required")   effective += 1;

  if (effective === 0) return "HIGH CONFIDENCE";
  if (effective <= 2)  return "MODERATE CONFIDENCE";
  return "LIMITED CONFIDENCE";
}

function packageLabel(pkg: string): string {
  switch (pkg) {
    case "standard": return "Specialist Tier ($139)";
    case "plus":     return "Plus Tier ($169)";
    case "exotic":   return "Exotic Tier ($299)";
    case "premium":  return "Plus Tier ($169)";
    default:         return pkg;
  }
}

function generateReportNumber(orderId: string, date: Date): string {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, "0");
  const dd   = String(date.getDate()).padStart(2, "0");
  const short = orderId.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `RC-${yyyy}-${mm}${dd}-${short}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    // 1. Fetch order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", params.orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Payment gate
    if (!canProceedWithRideCheck(order)) {
      return NextResponse.json({ error: PAYMENT_GATE_ERRORS.report_generation }, { status: 402 });
    }

    // 2. Fetch raw submission
    const { data: submission, error: subError } = await supabaseAdmin
      .from("ridechecker_raw_submissions")
      .select("*")
      .eq("order_id", params.orderId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError || !submission) {
      return NextResponse.json(
        { error: "No inspection submission found for this order. The RideChecker must submit their findings first." },
        { status: 400 }
      );
    }

    // 3. Build Claude input
    const inspectionDate = new Date(submission.submitted_at || new Date());
    const reportNumber = generateReportNumber(order.order_id || params.orderId, inspectionDate);

    const dateStr = inspectionDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const reportInput: ReportInput = {
      vehicle_year:          String(order.vehicle_year || ""),
      vehicle_make:          order.vehicle_make || "",
      vehicle_model:         order.vehicle_model || "",
      vehicle_trim:          order.vehicle_trim || undefined,
      vehicle_mileage:       order.vehicle_mileage || undefined,
      vehicle_price:         order.vehicle_price || undefined,
      inspection_address:    order.inspection_address || undefined,
      listing_source:        order.listing_source || undefined,
      platform_source:       order.platform_source || undefined,
      vehicle_seen_location: order.vehicle_seen_location || undefined,
      order_id:              order.order_id || params.orderId,
      package:               order.package || "standard",
      inspection_date:       dateStr,
      cosmetic_exterior:     submission.cosmetic_exterior || "",
      interior_condition:    submission.interior_condition || "",
      mechanical_issues:     submission.mechanical_issues || "",
      test_drive_notes:      submission.test_drive_notes || "",
      immediate_concerns:    submission.immediate_concerns || "",
      scan_codes:            submission.scan_codes || [],
      brake_condition:       submission.brake_condition || undefined,
      tire_tread_mm_front_left:  submission.tire_tread_mm_front_left  || undefined,
      tire_tread_mm_front_right: submission.tire_tread_mm_front_right || undefined,
      tire_tread_mm_rear_left:   submission.tire_tread_mm_rear_left   || undefined,
      tire_tread_mm_rear_right:  submission.tire_tread_mm_rear_right  || undefined,
      vin_photo_url:         submission.vin_photo_url || "",
      odometer_photo_url:    submission.odometer_photo_url || "",
      under_hood_photo_url:  submission.under_hood_photo_url || "",
      undercarriage_photo_url: submission.undercarriage_photo_url || "",
      extra_photos:          submission.extra_photos || [],
      road_test_module:      submission.road_test_module ?? undefined,
      obd_module:            submission.obd_module ?? undefined,
      title_history_module:  submission.title_history_module ?? undefined,
    };

    // 4. Collect all submission photos for validation
    const rtMod  = submission.road_test_module as { photo_1_url?: string; photo_2_url?: string } | null | undefined;
    const obdMod = submission.obd_module as { uploaded_files?: Array<{ url: string; fileName: string; fileType: string }> } | null | undefined;
    const obdImageFiles = (obdMod?.uploaded_files || [])
      .filter((f) => f.fileType === "image")
      .map((f, i) => ({ url: f.url, label: `OBD diagnostic photo ${i + 1}` }));

    const rawPhotos = [
      { url: submission.vin_photo_url       || "", label: "VIN plate" },
      { url: submission.odometer_photo_url  || "", label: "Odometer" },
      { url: submission.under_hood_photo_url|| "", label: "Engine bay" },
      { url: submission.undercarriage_photo_url || "", label: "Undercarriage" },
      ...(submission.extra_photos || []).map((url: string, i: number) => ({
        url,
        label: `Extra photo ${i + 1}`,
      })),
      ...(rtMod?.photo_1_url ? [{ url: rtMod.photo_1_url, label: "Road test photo 1" }] : []),
      ...(rtMod?.photo_2_url ? [{ url: rtMod.photo_2_url, label: "Road test photo 2" }] : []),
      ...obdImageFiles,
      // THF VIN verification photos
      ...(submission.title_history_module?.dashboard_vin_photo_url
        ? [{ url: submission.title_history_module.dashboard_vin_photo_url, label: "VIN — dashboard" }] : []),
      ...(submission.title_history_module?.door_jamb_vin_photo_url
        ? [{ url: submission.title_history_module.door_jamb_vin_photo_url, label: "VIN — door jamb" }] : []),
    ].filter((p) => !!p.url);

    // 4a. Run report generation, photo validation, and risk check fetch in parallel
    const riskCheckPromise = supabaseAdmin
      .from("vehicle_risk_checks")
      .select("overall_risk_score, overall_risk_level, score_reasons, updated_at")
      .eq("order_id", params.orderId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const [generatedReport, photoValidationResults, riskCheckResult] = await Promise.all([
      generateReportWithClaude(reportInput),
      validatePhotos(rawPhotos),
      riskCheckPromise,
    ]);

    const { approved, excluded } = partitionResults(photoValidationResults);
    const approvedUrls = new Set(approved.map((r) => r.url));

    // Log excluded photos for ops review (fire-and-forget)
    if (excluded.length > 0) {
      writeOrderEvent({
        orderId:    params.orderId,
        eventType:  "photo_excluded_ops_review",
        actorId:    actor.userId,
        actorEmail: actor.email,
        details: {
          excluded_count: excluded.length,
          excluded_photos: excluded.map((r) => ({
            label:  r.label,
            reason: r.reason,
            url:    r.url,
          })),
        },
        isInternal: true,
      }).catch(() => {});
    }

    // Helper: return URL only if approved, otherwise empty string
    const safe = (url: string) => (approvedUrls.has(url) ? url : "");

    // 5. Build report metadata (photos filtered to approved only)
    const scopeTable   = buildScopeTable(submission);
    const missingItems = buildMissingItems(submission);
    const rtModule     = submission.road_test_module ?? undefined;

    const reportMeta: ReportMeta = {
      report_number:      reportNumber,
      inspection_date:    dateStr,
      vehicle_year:       String(order.vehicle_year || ""),
      vehicle_make:       order.vehicle_make || "",
      vehicle_model:      order.vehicle_model || "",
      vehicle_trim:       order.vehicle_trim || "",
      vehicle_mileage:    order.vehicle_mileage ? `${Number(order.vehicle_mileage).toLocaleString()} mi` : "Not recorded",
      vehicle_price:      order.vehicle_price ? `$${Number(order.vehicle_price).toLocaleString()}` : "Not provided",
      inspection_location: order.inspection_address || "Illinois area",
      package_tier:       packageLabel(order.package || "standard"),
      vin_photo_url:      safe(submission.vin_photo_url || ""),
      odometer_photo_url: safe(submission.odometer_photo_url || ""),
      under_hood_photo_url: safe(submission.under_hood_photo_url || ""),
      undercarriage_photo_url: safe(submission.undercarriage_photo_url || ""),
      extra_photos: (submission.extra_photos || []).filter((url: string) => approvedUrls.has(url)),
      scope_table:        scopeTable,
      confidence_level:   buildConfidenceLevel(submission, missingItems.length),
      missing_items:      missingItems,
      road_test_module:       rtModule,
      obd_module:             submission.obd_module ?? undefined,
      title_history_module:   submission.title_history_module ?? undefined,
    };

    // 5b. Attach risk intelligence to meta if available (riskCheckResult from parallel block above)
    if (riskCheckResult.data?.overall_risk_score != null) {
      const rc = riskCheckResult.data;

      // Fetch sub-checks to build summary
      const [vinChk, recallChk, floodChk, theftChk, marketChk] = await Promise.all([
        supabaseAdmin.from("vehicle_vin_checks").select("*").eq("order_id", params.orderId).order("checked_at", { ascending: false }).limit(1).maybeSingle(),
        supabaseAdmin.from("vehicle_recall_checks").select("*").eq("order_id", params.orderId).order("checked_at", { ascending: false }).limit(1).maybeSingle(),
        supabaseAdmin.from("vehicle_flood_checks").select("*").eq("order_id", params.orderId).order("checked_at", { ascending: false }).limit(1).maybeSingle(),
        supabaseAdmin.from("vehicle_theft_checks").select("*").eq("order_id", params.orderId).order("checked_at", { ascending: false }).limit(1).maybeSingle(),
        supabaseAdmin.from("vehicle_market_value_checks").select("*").eq("order_id", params.orderId).order("checked_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      reportMeta.risk_intelligence = {
        overall_score:       rc.overall_risk_score as number,
        overall_level:       rc.overall_risk_level as "LOW" | "MODERATE" | "ELEVATED" | "HIGH",
        vin_valid:           (vinChk.data?.vin_valid ?? null) as boolean | null,
        vin_decoded_make:    (vinChk.data?.decoded_make ?? null) as string | null,
        vin_decoded_year:    (vinChk.data?.decoded_year ?? null) as string | null,
        recall_count:        (recallChk.data?.recall_count ?? 0) as number,
        recall_severity:     (recallChk.data?.highest_severity ?? "NONE") as string,
        flood_score:         (floodChk.data?.flood_risk_score ?? 0) as number,
        flood_level:         (floodChk.data?.flood_risk_level ?? "LOW") as string,
        flood_active_count:  (() => {
          const findings = floodChk.data?.findings as { indicators?: Array<{ present: boolean }> } | null;
          return (findings?.indicators ?? []).filter((i) => i.present).length;
        })(),
        theft_status:        (theftChk.data?.theft_status ?? "UNABLE_TO_VERIFY") as string,
        market_variance_pct: (marketChk.data?.variance_percent ?? null) as number | null,
        pricing_risk:        (marketChk.data?.pricing_risk_level ?? null) as string | null,
        reasons:             (Array.isArray(rc.score_reasons) ? rc.score_reasons : []) as string[],
        hard_stops:          [] as string[],
        checked_at:          (rc.updated_at ?? new Date().toISOString()) as string,
      };
    }

    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { RideCheckReport }  = await import("@/lib/report/pdf-template");

    const pdfBuffer = await renderToBuffer(
      React.createElement(RideCheckReport, { report: generatedReport, meta: reportMeta }) as any
    );

    // 7. Upload to Supabase Storage
    const storagePath = `orders/${params.orderId}/${reportNumber}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("reports")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[generate-report] storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload report to storage" },
        { status: 500 }
      );
    }

    // 8. Create a 7-day signed URL for the report
    const { data: signedData } = await supabaseAdmin.storage
      .from("reports")
      .createSignedUrl(storagePath, 7 * 24 * 3600);

    const reportUrl = signedData?.signedUrl || null;

    // 9. Update order with report data (internal JSON stored privately for ML/audit)
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        report_storage_path:  storagePath,
        ops_report_url:       reportUrl,
        ops_summary:          generatedReport.overall_summary,
        ops_severity_overall: mapVerdictToSeverity(generatedReport.verdict),
        ops_recommendation:   mapVerdictToRecommendation(generatedReport.verdict),
        report_status:        "in_review",
        report_logic_version: REPORT_LOGIC_VERSION,
        report_internal_json: generatedReport as unknown as Record<string, unknown>,
        updated_at:           new Date().toISOString(),
      })
      .eq("id", params.orderId);

    if (updateError) {
      console.error("[generate-report] order update error:", updateError);
    }

    // 10. Audit
    await Promise.all([
      writeOrderEvent({
        orderId:    params.orderId,
        eventType:  "report_generated",
        actorId:    actor.userId,
        actorEmail: actor.email,
        details:    { report_number: reportNumber, verdict: generatedReport.verdict },
        isInternal: true,
      }),
      writeAuditLog({
        actorId:    actor.userId,
        actorEmail: actor.email,
        actorRole:  actor.role,
        action:     "order.report_generated",
        resourceId: params.orderId,
        newValue:   { report_number: reportNumber, verdict: generatedReport.verdict, storage_path: storagePath },
      }),
    ]);

    return NextResponse.json({
      success:              true,
      report_number:        reportNumber,
      report_url:           reportUrl,
      verdict:              generatedReport.verdict,
      report_logic_version: REPORT_LOGIC_VERSION,
    });
  } catch (err: any) {
    console.error("[generate-report] error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate report" }, { status: 500 });
  }
}

function mapVerdictToSeverity(verdict: string): string {
  switch (verdict) {
    case "LOW_RISK":      return "minor";
    case "MODERATE_RISK": return "moderate";
    case "HIGH_RISK":     return "major";
    default:              return "moderate";
  }
}

function mapVerdictToRecommendation(verdict: string): string {
  switch (verdict) {
    case "LOW_RISK":      return "BUY";
    case "MODERATE_RISK": return "BUY_WITH_NEGOTIATION";
    case "HIGH_RISK":     return "DO_NOT_BUY_AT_ASKING_PRICE";
    default:              return "BUY_WITH_NEGOTIATION";
  }
}
