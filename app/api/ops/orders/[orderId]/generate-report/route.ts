import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateReportWithClaude } from "@/lib/report/claude-generate";
import { REPORT_LOGIC_VERSION } from "@/lib/report/report-version";
import type { ReportInput, ReportMeta, ScopeRow, ConfidenceLevel } from "@/lib/report/types";
import React from "react";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function buildScopeTable(submission: any): ScopeRow[] {
  const hasOBD = Array.isArray(submission.scan_codes) && submission.scan_codes.length > 0;
  const hasUndercarriage = !!submission.undercarriage_photo_url;
  const hasBrakes = !!(submission.brake_condition && submission.brake_condition.trim().length > 0);
  const hasTread = [
    submission.tire_tread_mm_front_left,
    submission.tire_tread_mm_front_right,
    submission.tire_tread_mm_rear_left,
    submission.tire_tread_mm_rear_right,
  ].some((v) => v != null);
  const hasRoadTest = !!(submission.test_drive_notes && submission.test_drive_notes.trim().length > 10);

  return [
    { system: "Engine",            level: hasOBD          ? "Visual + OBD Scan"         : "Visual Only",    status: hasOBD          ? "assessed"     : "partial"      },
    { system: "OBD Scan",          level: hasOBD          ? "Full Scan Performed"        : "Not Performed",  status: hasOBD          ? "assessed"     : "not_assessed"  },
    { system: "Frame / Underbody", level: hasUndercarriage ? "Visual Only"               : "Not Assessed",   status: hasUndercarriage ? "partial"      : "not_assessed"  },
    { system: "Brakes",            level: hasBrakes        ? "Assessed"                  : "Not Assessed",   status: hasBrakes        ? "assessed"     : "not_assessed"  },
    { system: "Transmission",      level: hasRoadTest      ? "Road Test Observed"        : "Visual Only",    status: "partial"                                           },
    { system: "Electrical",        level: "Visual Only",                                                      status: "partial"                                           },
    { system: "Tires",             level: hasTread         ? "Visual + Tread Measured"   : "Visual Only",    status: hasTread         ? "assessed"     : "partial"       },
    { system: "Road Test",         level: hasRoadTest      ? "Completed"                 : "Not Performed",  status: hasRoadTest      ? "assessed"     : "not_assessed"  },
  ];
}

function buildMissingItems(submission: any): string[] {
  const items: string[] = [];
  if (!Array.isArray(submission.scan_codes) || submission.scan_codes.length === 0)
    items.push("No OBD diagnostic codes retrieved");
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
  if (!submission.test_drive_notes || submission.test_drive_notes.trim().length <= 10)
    items.push("Road test not performed");
  return items;
}

function buildConfidenceLevel(missingCount: number): ConfidenceLevel {
  if (missingCount === 0) return "HIGH CONFIDENCE";
  if (missingCount <= 2)  return "MODERATE CONFIDENCE";
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
    };

    // 4. Generate report content with Claude
    const generatedReport = await generateReportWithClaude(reportInput);

    // 5. Build report metadata
    const scopeTable   = buildScopeTable(submission);
    const missingItems = buildMissingItems(submission);

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
      vin_photo_url:      submission.vin_photo_url || "",
      odometer_photo_url: submission.odometer_photo_url || "",
      under_hood_photo_url: submission.under_hood_photo_url || "",
      undercarriage_photo_url: submission.undercarriage_photo_url || "",
      extra_photos:       submission.extra_photos || [],
      scope_table:        scopeTable,
      confidence_level:   buildConfidenceLevel(missingItems.length),
      missing_items:      missingItems,
    };

    // 6. Generate PDF
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
