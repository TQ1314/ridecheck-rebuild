import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStep, isStepComplete } from "@/lib/inspection/steps";
import type { StepData } from "@/lib/inspection/steps";
import { canProceedWithRideCheck, PAYMENT_GATE_ERRORS } from "@/lib/payment/payment-gate";

export const dynamic = "force-dynamic";

// ── PATCH — save / upsert a step ─────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  const result = await requireRole(["ridechecker_active", "owner", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const { assignmentId } = params;
  const body = await req.json().catch(() => ({}));
  const { step_key, answer, severity, note, wide_photo_url, close_photo_url, obd_module } = body as {
    step_key?: string;
    answer?: string;
    severity?: string;
    note?: string;
    wide_photo_url?: string;
    close_photo_url?: string;
    obd_module?: Record<string, unknown> | null;
  };

  if (!step_key) {
    return NextResponse.json({ error: "step_key is required" }, { status: 400 });
  }

  const stepDef = getStep(step_key);
  if (!stepDef) {
    return NextResponse.json({ error: `Unknown step_key: ${step_key}` }, { status: 400 });
  }

  // Verify session ownership
  const { data: session } = await supabaseAdmin
    .from("ridecheck_inspection_sessions")
    .select("id, order_id, ridechecker_id, status")
    .eq("assignment_id", assignmentId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "No active inspection session found" }, { status: 404 });
  }

  if (result.actor.role === "ridechecker_active" && session.ridechecker_id !== result.actor.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: gateOrder, error: gateError } = await supabaseAdmin
    .from("orders")
    .select("payment_status, payment_required, payment_override_approved")
    .eq("id", session.order_id)
    .maybeSingle();
  if (gateError) {
    console.error("[inspect step payment gate]", gateError);
    return NextResponse.json({ error: "Could not verify payment before saving inspection work" }, { status: 500 });
  }
  if (!gateOrder || !canProceedWithRideCheck(gateOrder)) {
    return NextResponse.json({ error: PAYMENT_GATE_ERRORS.inspection_start }, { status: 402 });
  }

  // Build step data to check completion
  const stepData: StepData = {
    step_key,
    answer: answer ?? null,
    severity: severity ?? null,
    note: note ?? null,
    wide_photo_url: wide_photo_url ?? null,
    close_photo_url: close_photo_url ?? null,
    obd_module: obd_module ?? null,
  };

  const completed = isStepComplete(stepDef, stepData);
  const now = new Date().toISOString();

  // Keep structured OBD data backward-compatible with the existing wizard
  // schema. The marker is deliberately machine-readable and is unpacked on
  // session load/submission; the human note remains available to Ops.
  const persistedNote = obd_module !== undefined
    ? `${note ?? ""}\n[RIDECHECK_OBD_MODULE]${JSON.stringify(obd_module)}[/RIDECHECK_OBD_MODULE]`
    : note;
  const upsertPayload: Record<string, unknown> = {
    session_id: session.id,
    assignment_id: assignmentId,
    step_key,
    section: stepDef.section,
    completed,
    updated_at: now,
    ...(answer !== undefined ? { answer } : {}),
    ...(severity !== undefined ? { severity } : {}),
    ...(note !== undefined || obd_module !== undefined ? { note: persistedNote } : {}),
    ...(wide_photo_url !== undefined ? { wide_photo_url } : {}),
    ...(close_photo_url !== undefined ? { close_photo_url } : {}),
    ...(completed ? { completed_at: now } : {}),
  };

  const { data: saved, error } = await supabaseAdmin
    .from("ridecheck_inspection_steps")
    .upsert(upsertPayload, { onConflict: "session_id,step_key" })
    .select()
    .single();

  if (error) {
    console.error("[inspect step upsert]", error);
    return NextResponse.json({ error: "Failed to save step" }, { status: 500 });
  }

  // Update session updated_at
  await supabaseAdmin
    .from("ridecheck_inspection_sessions")
    .update({ updated_at: now })
    .eq("id", session.id);

  return NextResponse.json({ step: saved, completed });
}
