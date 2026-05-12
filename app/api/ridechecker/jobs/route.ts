import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SAFE_ORDER_COLUMNS = "order_id, vehicle_year, vehicle_make, vehicle_model, vehicle_location, inspection_address, scheduled_date, scheduled_time, inspector_status, report_status, package, booking_type, created_at";

// Full column set — may not be present in all prod DB versions
const ASSIGNMENT_SELECT_FULL =
  "id, order_id, status, expires_at, scheduled_start, scheduled_end, " +
  "accepted_at, started_at, submitted_at, approved_at, rejected_at, " +
  "declined_at, rejection_reason, job_score, payout_amount, payout_status, created_at";

// Minimal guaranteed columns — safe for all migration versions
const ASSIGNMENT_SELECT_MINIMAL =
  "id, order_id, status, expires_at, accepted_at, started_at, " +
  "submitted_at, approved_at, rejected_at, declined_at, created_at";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker", "ridechecker_active", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: inspector } = await supabaseAdmin
      .from("inspectors")
      .select("id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    let jobs: any[] = [];
    let assignments: any[] = [];

    if (inspector) {
      const { data, error } = await supabaseAdmin
        .from("orders")
        .select(SAFE_ORDER_COLUMNS)
        .eq("assigned_inspector_id", inspector.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        jobs = data;
      }
    }

    // ── Primary: query ridechecker_job_assignments ───────────────────────────
    // Try full column set first; fall back to minimal if columns are missing in DB
    let assignmentData: any[] | null = null;

    const { data: fullData, error: fullErr } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .select(ASSIGNMENT_SELECT_FULL)
      .eq("ridechecker_id", session.user.id)
      .order("created_at", { ascending: false });

    if (fullErr) {
      if (fullErr.code === "42703") {
        // Column missing — retry with minimal safe columns
        const { data: minData, error: minErr } = await supabaseAdmin
          .from("ridechecker_job_assignments")
          .select(ASSIGNMENT_SELECT_MINIMAL)
          .eq("ridechecker_id", session.user.id)
          .order("created_at", { ascending: false });

        if (minErr) {
          console.error("[ridechecker/jobs] minimal assignment query failed:", minErr.message, minErr.code);
        } else {
          assignmentData = minData ?? [];
        }
      } else {
        console.error("[ridechecker/jobs] assignment query failed:", fullErr.message, fullErr.code);
      }
    } else {
      assignmentData = fullData ?? [];
    }

    if (assignmentData && assignmentData.length > 0) {
      const orderIds = assignmentData.map((a: any) => a.order_id).filter(Boolean);

      if (orderIds.length > 0) {
        const { data: orderData, error: orderErr } = await supabaseAdmin
          .from("orders")
          .select(SAFE_ORDER_COLUMNS + ", id")
          .in("id", orderIds);

        if (orderErr) {
          console.error("[ridechecker/jobs] order enrichment query failed:", orderErr.message);
        }

        const orderMap: Record<string, any> = {};
        if (orderData) {
          for (const o of orderData as any[]) {
            orderMap[o.id] = o;
          }
        }

        assignments = assignmentData.map((a: any) => ({
          id: a.id,
          order_id: a.order_id,
          status: a.status,
          expires_at: a.expires_at ?? null,
          scheduled_start: a.scheduled_start ?? null,
          scheduled_end: a.scheduled_end ?? null,
          accepted_at: a.accepted_at ?? null,
          started_at: a.started_at ?? null,
          submitted_at: a.submitted_at ?? null,
          approved_at: a.approved_at ?? null,
          rejected_at: a.rejected_at ?? null,
          declined_at: a.declined_at ?? null,
          rejection_reason: a.rejection_reason ?? null,
          job_score: a.job_score ?? null,
          payout_amount: a.payout_amount ?? null,
          payout_status: a.payout_status ?? null,
          created_at: a.created_at,
          order: orderMap[a.order_id] || null,
        }));
      }
    }

    // ── Fallback: surface orders assigned directly via assigned_ridechecker_id ─
    // Covers cases where no ridechecker_job_assignments row exists (e.g. pre-backfill)
    const assignedOrderIds = new Set(assignments.map((a: any) => a.order_id));

    const { data: directOrders, error: directErr } = await supabaseAdmin
      .from("orders")
      .select(SAFE_ORDER_COLUMNS + ", id, assignment_status, assigned_ridechecker_id")
      .eq("assigned_ridechecker_id", session.user.id)
      .not("assignment_status", "in", '("unassigned","cancelled","completed")');

    if (directErr) {
      // Handle NULL assignment_status edge case — retry without the NOT IN filter
      // so orders where assignment_status IS NULL still surface
      console.error("[ridechecker/jobs] direct orders query failed:", directErr.message);

      const { data: directOrdersNullSafe } = await supabaseAdmin
        .from("orders")
        .select(SAFE_ORDER_COLUMNS + ", id, assignment_status, assigned_ridechecker_id")
        .eq("assigned_ridechecker_id", session.user.id);

      if (directOrdersNullSafe) {
        for (const o of directOrdersNullSafe as any[]) {
          if (!assignedOrderIds.has(o.id) &&
              !["unassigned", "cancelled", "completed"].includes(o.assignment_status ?? "")) {
            assignments.push(buildFallbackAssignment(o));
            assignedOrderIds.add(o.id);
          }
        }
      }
    } else if (directOrders) {
      for (const o of directOrders as any[]) {
        if (!assignedOrderIds.has(o.id)) {
          assignments.push(buildFallbackAssignment(o));
          assignedOrderIds.add(o.id);
        }
      }
    }

    const activeStatuses = ["en_route", "on_site", "inspecting", "wrapping_up"];
    const stats = {
      totalJobs: jobs.length + assignments.length,
      activeJobs:
        jobs.filter((j) => activeStatuses.includes(j.inspector_status)).length +
        assignments.filter((a: any) => ["accepted", "in_progress", "en_route", "arrived", "inspection_started", "inspecting"].includes(a.status)).length,
      completedJobs:
        jobs.filter((j) => j.inspector_status === "completed").length +
        assignments.filter((a: any) => ["approved", "paid", "submitted", "report_processing"].includes(a.status)).length,
      pendingUpload: jobs.filter(
        (j) => j.inspector_status === "completed" && (!j.report_status || j.report_status === "pending_upload")
      ).length,
    };

    return NextResponse.json({ jobs, assignments, stats });
  } catch (err: any) {
    console.error("[ridechecker/jobs] unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function buildFallbackAssignment(o: any): any {
  return {
    id: null,
    order_id: o.id,
    status: o.assignment_status || "assigned",
    expires_at: null,
    scheduled_start: null,
    scheduled_end: null,
    accepted_at: null,
    started_at: null,
    submitted_at: null,
    approved_at: null,
    rejected_at: null,
    declined_at: null,
    rejection_reason: null,
    job_score: null,
    payout_amount: null,
    payout_status: null,
    created_at: o.created_at,
    order: o,
    _direct_assign_fallback: true,
  };
}
