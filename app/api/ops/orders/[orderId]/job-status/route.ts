import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const result = await requireRole(["owner", "operations_lead", "operations", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const { orderId } = params;

  // Most recent non-terminal assignment for this order
  const { data: assignment, error } = await supabaseAdmin
    .from("ridechecker_job_assignments")
    .select(
      `id, order_id, ridechecker_id, status,
       accepted_at, en_route_at, arrived_at, inspection_started_at,
       photos_uploading_at, report_pending_at, escalated_at,
       last_status_update_at, last_known_lat, last_known_lng,
       last_location_update_at, delay_notes, escalation_notes,
       rejection_reason, declined_at, created_at,
       ridechecker:profiles!ridechecker_id(id, full_name, phone, email)`
    )
    .eq("order_id", orderId)
    .not("status", "in", "('declined','expired','cancelled')")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[job-status GET error]", error);
    return NextResponse.json({ error: "Failed to fetch job status" }, { status: 500 });
  }

  if (!assignment) {
    return NextResponse.json({ assignment: null, status_log: [] });
  }

  const { data: statusLog } = await supabaseAdmin
    .from("ridechecker_job_status_log")
    .select("old_status, new_status, notes, created_at")
    .eq("assignment_id", assignment.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    assignment,
    status_log: statusLog ?? [],
  });
}
