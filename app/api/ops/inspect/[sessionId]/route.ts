import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { INSPECTION_STEPS } from "@/lib/inspection/steps";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const result = await requireRole(["owner", "admin", "operations_lead", "ops_lead", "operations"]);
  if (!isAuthorized(result)) return result.error;

  const { sessionId } = params;

  // Load session
  const { data: session } = await supabaseAdmin
    .from("ridecheck_inspection_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Load assignment + RC + order in parallel
  const [assignmentRes, stepsRes, issuesRes] = await Promise.all([
    supabaseAdmin
      .from("ridechecker_job_assignments")
      .select("id, status, ridechecker_id, created_at, accepted_at, inspection_started_at, submitted_at")
      .eq("id", session.assignment_id)
      .maybeSingle(),
    supabaseAdmin
      .from("ridecheck_inspection_steps")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("ridecheck_inspection_issues")
      .select("*")
      .eq("assignment_id", session.assignment_id)
      .order("created_at", { ascending: true }),
  ]);

  const [orderRes, rcRes] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("id, order_id, vehicle_year, vehicle_make, vehicle_model, vehicle_trim, inspection_address, vehicle_location, package, booking_type")
      .eq("id", session.order_id)
      .maybeSingle(),
    assignmentRes.data?.ridechecker_id
      ? supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, phone")
          .eq("id", assignmentRes.data.ridechecker_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const stepMap = new Map((stepsRes.data ?? []).map((s) => [s.step_key, s]));

  // Group steps by section following defined order
  const stepsBySection: Record<string, { stepDef: typeof INSPECTION_STEPS[0]; stepData: Record<string, unknown> | null }[]> = {};

  for (const stepDef of INSPECTION_STEPS) {
    if (!stepsBySection[stepDef.section]) {
      stepsBySection[stepDef.section] = [];
    }
    stepsBySection[stepDef.section].push({
      stepDef,
      stepData: stepMap.get(stepDef.key) ?? null,
    });
  }

  const concerns = (stepsRes.data ?? []).filter((s) => s.answer === "concern");
  const notAccessible = (stepsRes.data ?? []).filter((s) => s.answer === "not_accessible");
  const completed = (stepsRes.data ?? []).filter((s) => s.completed);
  const criticalConcerns = concerns.filter((s) => s.severity === "critical" || s.severity === "high");

  return NextResponse.json({
    session,
    assignment: assignmentRes.data,
    order: orderRes.data,
    ridechecker: rcRes.data,
    steps_by_section: stepsBySection,
    all_steps: stepsRes.data ?? [],
    issues: issuesRes.data ?? [],
    summary: {
      total_steps: INSPECTION_STEPS.length,
      completed_count: completed.length,
      concerns_count: concerns.length,
      not_accessible_count: notAccessible.length,
      critical_count: criticalConcerns.length,
      photo_count: (stepsRes.data ?? []).reduce(
        (acc, s) => acc + (s.wide_photo_url ? 1 : 0) + (s.close_photo_url ? 1 : 0),
        0
      ),
    },
  });
}
