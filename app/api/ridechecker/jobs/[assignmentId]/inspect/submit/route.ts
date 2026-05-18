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

  // ── 1. Mark session submitted ─────────────────────────────────────────────
  const { error: sessionErr } = await supabaseAdmin
    .from("ridecheck_inspection_sessions")
    .update({ status: "submitted", submitted_at: now, updated_at: now })
    .eq("id", session.id);

  if (sessionErr) {
    console.error("[inspect submit session]", sessionErr);
    return NextResponse.json({ error: "Failed to submit session" }, { status: 500 });
  }

  // ── 2. Write backward-compat ridechecker_raw_submissions record ───────────
  const vinStep   = stepMap.get("vin_dashboard");
  const odoStep   = stepMap.get("odometer");
  const engineStep = stepMap.get("engine_bay_overview");
  const underStep = stepMap.get("underbody_front");
  const summaryStep = stepMap.get("field_summary");

  const concerns = [...stepMap.values()].filter((s) => s.answer === "concern");
  const notAccessible = [...stepMap.values()].filter((s) => s.answer === "not_accessible");

  const mechanicalNote = [
    stepMap.get("fluids_leaks")?.note,
    stepMap.get("oil_dipstick")?.note,
    stepMap.get("obd_scan")?.note,
    stepMap.get("obd_readiness")?.note,
  ].filter(Boolean).join("; ") || "See wizard submission";

  const immediateNote = concerns.length > 0
    ? concerns.map((s) => `[${s.step_key}] ${s.note ?? "Concern flagged"}`).join(" | ")
    : "No immediate concerns flagged";

  try {
    await supabaseAdmin.from("ridechecker_raw_submissions").insert({
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
      test_drive_notes: "Wizard submission — see inspection steps",
      immediate_concerns: immediateNote,
      submitted_at: now,
      extra_photos: [...stepMap.values()]
        .flatMap((s) => [s.wide_photo_url, s.close_photo_url])
        .filter(Boolean) as string[],
    });
  } catch (err) { console.error("[raw_submissions fallback]", err); }

  // ── 3. Update assignment status ───────────────────────────────────────────
  await supabaseAdmin
    .from("ridechecker_job_assignments")
    .update({
      status: "submitted",
      submitted_at: now,
      last_status_update_at: now,
    })
    .eq("id", assignmentId);

  // ── 4. Update order assignment_status ─────────────────────────────────────
  await supabaseAdmin
    .from("orders")
    .update({ assignment_status: "report_pending" })
    .eq("id", session.order_id);

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
