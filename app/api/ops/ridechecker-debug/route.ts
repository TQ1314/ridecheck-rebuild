import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/ops/ridechecker-debug?rc=<email_or_uuid>
 *
 * Ops/admin diagnostic endpoint.
 * Returns raw DB state for a given RideChecker:
 *  - profile row
 *  - all ridechecker_job_assignments rows
 *  - all orders with assigned_ridechecker_id matching
 *
 * Access: owner, operations_lead, ops_lead, operations, admin
 */
export async function GET(req: NextRequest) {
  const result = await requireRole(["owner", "operations_lead", "ops_lead", "operations", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const { searchParams } = new URL(req.url);
  const rc = searchParams.get("rc")?.trim();

  if (!rc) {
    return NextResponse.json(
      { error: "Pass ?rc=<email_or_uuid> to identify the RideChecker" },
      { status: 400 }
    );
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rc);

  // ── 1. Resolve profile ──────────────────────────────────────────────────────
  let profile: any = null;
  if (isUuid) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, is_active, verification_status, workflow_stage, availability_status, suspended_until")
      .eq("id", rc)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    profile = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, is_active, verification_status, workflow_stage, availability_status, suspended_until")
      .eq("email", rc)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    profile = data;
  }

  if (!profile) {
    return NextResponse.json({ error: `No profile found for: ${rc}` }, { status: 404 });
  }

  const rcId = profile.id;

  // ── 2. All ridechecker_job_assignments rows ─────────────────────────────────
  const { data: assignments, error: assignErr } = await supabaseAdmin
    .from("ridechecker_job_assignments")
    .select("id, order_id, ridechecker_id, status, expires_at, accepted_at, declined_at, created_at")
    .eq("ridechecker_id", rcId)
    .order("created_at", { ascending: false });

  if (assignErr) {
    console.error("[ridechecker-debug] assignment query error:", assignErr.message, assignErr.code);
  }

  // ── 3. All orders with assigned_ridechecker_id set to this RC ───────────────
  const { data: directOrders, error: ordersErr } = await supabaseAdmin
    .from("orders")
    .select("id, order_id, vehicle_year, vehicle_make, vehicle_model, assignment_status, assigned_ridechecker_id, ops_status, created_at")
    .eq("assigned_ridechecker_id", rcId)
    .order("created_at", { ascending: false });

  if (ordersErr) {
    console.error("[ridechecker-debug] orders query error:", ordersErr.message, ordersErr.code);
  }

  // ── 4. Cross-reference: orders with assignments but different ridechecker_id ─
  const assignedOrderIds = (assignments ?? []).map((a: any) => a.order_id);
  const directOrderIds = (directOrders ?? []).map((o: any) => o.id);
  const onlyInAssignments = assignedOrderIds.filter((id: string) => !directOrderIds.includes(id));
  const onlyInDirectOrders = directOrderIds.filter((id: string) => !assignedOrderIds.includes(id));

  return NextResponse.json({
    _note: "Raw diagnostic data. Do not expose to end users.",
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      role: profile.role,
      is_active: profile.is_active,
      verification_status: profile.verification_status ?? "(column may not exist)",
      workflow_stage: profile.workflow_stage ?? null,
      availability_status: profile.availability_status ?? "(column may not exist)",
      suspended_until: profile.suspended_until ?? null,
    },
    assignments: {
      count: (assignments ?? []).length,
      rows: assignments ?? [],
      error: assignErr ? assignErr.message : null,
    },
    direct_orders: {
      count: (directOrders ?? []).length,
      rows: directOrders ?? [],
      error: ordersErr ? ordersErr.message : null,
    },
    cross_reference: {
      assignment_order_ids_not_in_direct_orders: onlyInAssignments,
      direct_order_ids_without_assignment_row: onlyInDirectOrders,
      id_mismatch_suspected: onlyInDirectOrders.length > 0 || onlyInAssignments.length > 0,
    },
    diagnosis: {
      has_active_assignments: (assignments ?? []).some((a: any) =>
        !["cancelled", "declined", "expired", "rejected", "paid"].includes(a.status)
      ),
      awaiting_acceptance_count: (assignments ?? []).filter((a: any) => a.status === "awaiting_acceptance").length,
      jobs_api_would_query_with_id: rcId,
    },
  });
}
