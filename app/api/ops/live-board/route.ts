import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DONE_STATUSES = [
  "declined", "expired", "cancelled", "submitted",
  "approved", "paid", "rejected",
];

// Minutes after entering a status before it's flagged as a bottleneck
const BOTTLENECK_THRESHOLDS: Record<string, { minutes: number; reason: string }> = {
  accepted:           { minutes: 120,  reason: "Accepted but no movement in 2 hours" },
  en_route:           { minutes: 90,   reason: "En route for over 90 minutes" },
  arrived:            { minutes: 20,   reason: "Arrived but inspection not started" },
  inspection_started: { minutes: 150,  reason: "Inspection running over 2.5 hours" },
  photos_uploading:   { minutes: 60,   reason: "Photo upload taking over 1 hour" },
  report_pending:     { minutes: 1440, reason: "Report pending for over 24 hours" },
};

const STATUS_AT_COL: Record<string, string> = {
  en_route:           "en_route_at",
  arrived:            "arrived_at",
  inspection_started: "inspection_started_at",
  photos_uploading:   "photos_uploading_at",
  report_pending:     "report_pending_at",
  escalated:          "escalated_at",
};

function detectBottleneck(
  status: string,
  assignment: Record<string, unknown>
): { is_bottleneck: boolean; reason: string | null } {
  const threshold = BOTTLENECK_THRESHOLDS[status];
  if (!threshold) return { is_bottleneck: false, reason: null };

  const col = STATUS_AT_COL[status];
  const ref = (col ? assignment[col] : null) as string | null
    ?? (assignment.last_status_update_at as string | null)
    ?? (assignment.accepted_at as string | null);

  if (!ref) return { is_bottleneck: false, reason: null };

  const elapsedMin = (Date.now() - new Date(ref).getTime()) / 60000;
  return elapsedMin > threshold.minutes
    ? { is_bottleneck: true, reason: threshold.reason }
    : { is_bottleneck: false, reason: null };
}

export async function GET(_req: NextRequest) {
  const result = await requireRole(["owner", "operations_lead", "ops_lead", "operations", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const notIn = `(${DONE_STATUSES.map((s) => `'${s}'`).join(",")})`;

  const { data: assignments, error } = await supabaseAdmin
    .from("ridechecker_job_assignments")
    .select(
      `id, order_id, status,
       accepted_at, en_route_at, arrived_at, inspection_started_at,
       photos_uploading_at, report_pending_at, escalated_at,
       last_status_update_at, last_known_lat, last_known_lng,
       last_location_update_at, escalation_notes, created_at,
       ridechecker:profiles!ridechecker_id(id, full_name, phone),
       order:orders!order_id(id, order_id, vehicle_year, vehicle_make, vehicle_model, inspection_address, scheduled_date, scheduled_time)`
    )
    .not("status", "in", notIn)
    .order("last_status_update_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("[live-board GET error]", error);
    return NextResponse.json({ error: "Failed to fetch live board" }, { status: 500 });
  }

  const activeJobs = (assignments ?? []).map((a) => {
    const rc  = (a.ridechecker as unknown) as Record<string, unknown> | null;
    const ord = (a.order       as unknown) as Record<string, unknown> | null;
    const col = STATUS_AT_COL[a.status];
    const statusSince = (col ? (a as Record<string, unknown>)[col] : null) as string | null
      ?? a.last_status_update_at
      ?? a.accepted_at
      ?? a.created_at;

    const bottleneck = detectBottleneck(a.status, a as Record<string, unknown>);

    return {
      assignment_id:          a.id,
      order_id:               a.order_id,
      order_ref:              ord?.order_id ?? null,
      vehicle:                ord
        ? `${ord.vehicle_year ?? ""} ${ord.vehicle_make ?? ""} ${ord.vehicle_model ?? ""}`.trim()
        : null,
      inspection_address:     ord?.inspection_address ?? null,
      scheduled_date:         ord?.scheduled_date ?? null,
      scheduled_time:         ord?.scheduled_time ?? null,
      ridechecker_id:         rc?.id ?? null,
      ridechecker_name:       rc?.full_name ?? "Unknown",
      ridechecker_phone:      rc?.phone ?? null,
      status:                 a.status,
      status_since:           statusSince,
      last_known_lat:         a.last_known_lat,
      last_known_lng:         a.last_known_lng,
      last_location_update_at:a.last_location_update_at,
      escalation_notes:       a.escalation_notes,
      is_bottleneck:          bottleneck.is_bottleneck,
      bottleneck_reason:      bottleneck.reason,
    };
  });

  return NextResponse.json({ active_jobs: activeJobs });
}
