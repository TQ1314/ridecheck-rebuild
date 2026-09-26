import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { INSPECTION_STEPS, isStepComplete } from "@/lib/inspection/steps";
import type { StepData } from "@/lib/inspection/steps";
import { emitScoreEvents } from "@/lib/ridechecker/scorecard";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  const result = await requireRole(["ridechecker_active", "owner", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const { assignmentId } = params;

  // Load session
  const { data: session } = await supabaseAdmin
    .from("ridecheck_inspection_sessions")
    .select("id, order_id, ridechecker_id, status")
    .eq("assignment_id", assignmentId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "No active session to submit" }, { status: 404 });
  }

  if (result.actor.role === "ridechecker_active" && session.ridechecker_id !== result.actor.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Load all steps
  const { data: steps } = await supabaseAdmin
    .from("ridecheck_inspection_steps")
    .select("*")
    .eq("session_id", session.id);

  const stepMap = new Map<string, StepData>((steps ?? []).map((s) => [s.step_key, s]));

  // Check all steps are complete
  const incomplete: string[] = [];
  for (const stepDef of INSPECTION_STEPS) {
    const data = stepMap.get(stepDef.key) ?? null;
    if (!isStepComplete(stepDef, data)) {
      incomplete.push(stepDef.title);
    }
  }

  if (incomplete.length > 0) {
    return NextResponse.json(
      { error: "Incomplete steps", incomplete },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  // Persist the report's source record before closing the inspection session.
  // A failure here must not leave a submitted session with no report input.
  const vinStep   = stepMap.get("vin_dashboard");
  const odoStep   = stepMap.get("odometer");
  const engineStep = stepMap.get("engine_bay_overview");
  const underStep = stepMap.get("underbody_front");
  const summaryStep = stepMap.get("field_summary");
  const obdStep = stepMap.get("obd_scan");
  const obdMarker = obdStep?.note?.match(/\[RIDECHECK_OBD_MODULE\]([\s\S]*?)\[\/RIDECHECK_OBD_MODULE\]/);
  let obdModule: Record<string, unknown> | null = null;
  if (obdMarker) {
    try {
      const parsed = JSON.parse(obdMarker[1]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const guidedObd = parsed as Record<string, unknown>;
        // The guided form is inspector-authored JSON, not an extraction result.
        // Preserve explicitly marked AI codes for review; label otherwise
        // unlabeled hand-entered codes as manual.
        if (Array.isArray(guidedObd.dtc_codes)) {
          guidedObd.dtc_codes = guidedObd.dtc_codes.map((code: any) =>
            code && typeof code === "object" && !code.source
              ? { ...code, source: "manual" }
              : code
          );
        }
        obdModule = guidedObd;
      }
    } catch { /* malformed optional structured data is not report data */ }
  }
  const wizardPhotos = [obdStep?.wide_photo_url, obdStep?.close_photo_url]
    .filter((url): url is string => Boolean(url))
    .map((url, index) => ({
      url,
      fileName: `guided-obd-${index + 1}.jpg`,
      fileType: "image",
      reviewStatus: "approved_for_report",
      source_label: "manual",
    }));
  if (obdModule || wizardPhotos.length > 0) {
    // Photos remain report-addressable even when no structured scanner result
    // was available; explicitly label that state rather than inventing codes.
    obdModule ??= { scan_performed: "not_available" };
    const existingFiles = Array.isArray(obdModule.uploaded_files)
      ? obdModule.uploaded_files
      : [];
    obdModule.uploaded_files = [...existingFiles, ...wizardPhotos];
  }

  const concerns = [...stepMap.values()].filter((s) => s.answer === "concern");
  const notAccessible = [...stepMap.values()].filter((s) => s.answer === "not_accessible");

  const mechanicalNote = [
    stepMap.get("fluids_leaks")?.note,
    stepMap.get("oil_dipstick")?.note,
    obdStep?.note?.replace(/\[RIDECHECK_OBD_MODULE\][\s\S]*?\[\/RIDECHECK_OBD_MODULE\]/, "").trim(),
    stepMap.get("obd_readiness")?.note,
  ].filter(Boolean).join("; ") || "See wizard submission";

  const immediateNote = concerns.length > 0
    ? concerns.map((s) => `[${s.step_key}] ${s.note ?? "Concern flagged"}`).join(" | ")
    : "No immediate concerns flagged";

  const { data: existingRaw, error: lookupError } = await supabaseAdmin
    .from("ridechecker_raw_submissions")
    .select("id")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) {
    console.error("[inspect submit raw lookup]", lookupError);
    return NextResponse.json({ error: "Could not verify report input" }, { status: 500 });
  }
  const rawSubmission = {
      assignment_id: assignmentId,
      order_id: session.order_id,
      ridechecker_id: session.ridechecker_id,
      checklist_complete: true,
      vin_photo_url: vinStep?.wide_photo_url ?? vinStep?.close_photo_url ?? "",
      odometer_photo_url: odoStep?.wide_photo_url ?? odoStep?.close_photo_url ?? "",
      under_hood_photo_url: engineStep?.wide_photo_url ?? engineStep?.close_photo_url ?? "",
      undercarriage_photo_url: underStep?.wide_photo_url ?? underStep?.close_photo_url ?? "",
      cosmetic_exterior: [
        stepMap.get("exterior_front")?.note,
        stepMap.get("exterior_rear")?.note,
        stepMap.get("exterior_driver_side")?.note,
        stepMap.get("exterior_passenger_side")?.note,
        stepMap.get("body_damage")?.note,
      ].filter(Boolean).join("; ") || "See wizard submission",
      interior_condition: stepMap.get("interior_driver")?.note ?? "See wizard submission",
      mechanical_issues: mechanicalNote,
      obd_module: obdModule,
      test_drive_notes: "",
      immediate_concerns: immediateNote,
      submitted_at: now,
      extra_photos: [...stepMap.values()]
        .flatMap((s) => [s.wide_photo_url, s.close_photo_url])
        .filter(Boolean) as string[],
    };
  const rawWrite = existingRaw
    ? supabaseAdmin.from("ridechecker_raw_submissions").update(rawSubmission).eq("id", existingRaw.id)
    : supabaseAdmin.from("ridechecker_raw_submissions").insert(rawSubmission);
  const { error: rawError } = await rawWrite;
  if (rawError) {
    console.error("[inspect submit raw]", rawError);
    return NextResponse.json({ error: "Failed to save report input; inspection remains open" }, { status: 500 });
  }

  // ── Update assignment and order before closing the session ───────────────
  const { error: assignmentError } = await supabaseAdmin
    .from("ridechecker_job_assignments")
    .update({
      status: "submitted",
      submitted_at: now,
      last_status_update_at: now,
    })
    .eq("id", assignmentId);
  if (assignmentError) {
    console.error("[inspect submit assignment]", assignmentError);
    return NextResponse.json({ error: "Failed to update assignment; retry submission" }, { status: 500 });
  }

  const { error: orderError } = await supabaseAdmin
    .from("orders")
    .update({ assignment_status: "report_pending" })
    .eq("id", session.order_id);
  if (orderError) {
    console.error("[inspect submit order]", orderError);
    return NextResponse.json({ error: "Failed to update order; retry submission" }, { status: 500 });
  }

  const { error: sessionErr } = await supabaseAdmin
    .from("ridecheck_inspection_sessions")
    .update({ status: "submitted", submitted_at: now, updated_at: now })
    .eq("id", session.id);
  if (sessionErr) {
    console.error("[inspect submit session]", sessionErr);
    return NextResponse.json({ error: "Failed to close inspection; retry submission" }, { status: 500 });
  }

  // ── 5. Log status change ──────────────────────────────────────────────────
  try {
    await supabaseAdmin.from("ridechecker_job_status_log").insert({
      assignment_id: assignmentId,
      order_id: session.order_id,
      ridechecker_id: session.ridechecker_id,
      old_status: "inspection_started",
      new_status: "submitted",
      notes: `Wizard submission. ${concerns.length} concern(s), ${notAccessible.length} not-accessible.`,
    });
  } catch { }

  // Stage 1 scoring — wizard always validates completeness before reaching here
  emitScoreEvents([
    { ridecheckerId: session.ridechecker_id, assignmentId, orderId: session.order_id, eventType: "submitted_inspection" },
    { ridecheckerId: session.ridechecker_id, assignmentId, orderId: session.order_id, eventType: "all_required_photos" },
    { ridecheckerId: session.ridechecker_id, assignmentId, orderId: session.order_id, eventType: "no_missing_steps" },
  ]).catch(() => {});

  return NextResponse.json({
    success: true,
    session_id: session.id,
    concerns: concerns.length,
    not_accessible: notAccessible.length,
  });
}
