import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { INSPECTION_STEPS } from "@/lib/inspection/steps";

export const dynamic = "force-dynamic";

// ── GET — load existing session + step data ───────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  const result = await requireRole(["ridechecker_active", "owner", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const { assignmentId } = params;

  // Verify ownership (RideCheckers can only access their own)
  const { data: assignment } = await supabaseAdmin
    .from("ridechecker_job_assignments")
    .select("id, order_id, ridechecker_id, status")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  if (result.actor.role === "ridechecker_active" && assignment.ridechecker_id !== result.actor.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find most recent in_progress or submitted session
  const { data: session } = await supabaseAdmin
    .from("ridecheck_inspection_sessions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "No session found" }, { status: 404 });
  }

  // Load all steps for this session
  const { data: steps } = await supabaseAdmin
    .from("ridecheck_inspection_steps")
    .select("*")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    session,
    steps: steps ?? [],
    assignment: { id: assignment.id, status: assignment.status, order_id: assignment.order_id },
  });
}

// ── POST — create or resume session ──────────────────────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  const result = await requireRole(["ridechecker_active", "owner", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const { assignmentId } = params;

  const { data: assignment } = await supabaseAdmin
    .from("ridechecker_job_assignments")
    .select("id, order_id, ridechecker_id, status")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  if (result.actor.role === "ridechecker_active" && assignment.ridechecker_id !== result.actor.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const readyStatuses = ["assigned", "accepted", "en_route", "arrived", "inspection_started", "inspecting", "in_progress"];
  if (!readyStatuses.includes(assignment.status)) {
    return NextResponse.json(
      { error: `Assignment status '${assignment.status}' is not ready for inspection.` },
      { status: 400 }
    );
  }

  // Check for existing in_progress session
  const { data: existing } = await supabaseAdmin
    .from("ridecheck_inspection_sessions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Load steps for existing session
    const { data: steps } = await supabaseAdmin
      .from("ridecheck_inspection_steps")
      .select("*")
      .eq("session_id", existing.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({ session: existing, steps: steps ?? [], resumed: true });
  }

  // Create new session
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from("ridecheck_inspection_sessions")
    .insert({
      assignment_id: assignmentId,
      order_id: assignment.order_id,
      ridechecker_id: assignment.ridechecker_id,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (sessionErr || !session) {
    console.error("[inspect session create]", sessionErr);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  // Advance assignment to inspection_started if not already
  const advanceStatuses = ["assigned", "accepted", "en_route", "arrived"];
  if (advanceStatuses.includes(assignment.status)) {
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("ridechecker_job_assignments")
      .update({
        status: "inspection_started",
        inspection_started_at: now,
        last_status_update_at: now,
      })
      .eq("id", assignmentId);

    await supabaseAdmin
      .from("orders")
      .update({ assignment_status: "in_progress" })
      .eq("id", assignment.order_id);
  }

  return NextResponse.json({ session, steps: [], resumed: false });
}
