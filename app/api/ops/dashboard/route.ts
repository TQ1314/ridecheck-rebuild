import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type Urgency = "high" | "medium" | "low" | "done";

interface NextAction {
  label: string;
  urgency: Urgency;
  link?: string;
}

function computeNextAction(order: any): NextAction {
  const { id, status, assignment_status, payment_status } = order;
  const base = `/operations/orders/${id}`;

  // Cancelled / done
  if (status === "cancelled") return { label: "Cancelled", urgency: "done" };
  if (status === "completed") return { label: "Complete", urgency: "done" };
  if (status === "report_sent") return { label: "Report Sent", urgency: "done" };

  // Payment
  if (!payment_status || ["not_requested", "unpaid", "pending", "requested"].includes(payment_status)) {
    return { label: "Collect Payment", urgency: "medium", link: base };
  }
  if (payment_status === "failed") {
    return { label: "Payment Failed", urgency: "high", link: base };
  }

  // Assignment
  const paid = ["paid", "paid_manual_verified"].includes(payment_status);
  if (paid) {
    if (!assignment_status || assignment_status === "unassigned") {
      return { label: "Assign RideChecker", urgency: "high", link: base };
    }
    if (assignment_status === "awaiting_acceptance") {
      return { label: "Awaiting RC Accept", urgency: "medium", link: base };
    }
    if (assignment_status === "declined" || assignment_status === "expired") {
      return { label: "Reassign RideChecker", urgency: "high", link: base };
    }
    if (assignment_status === "accepted") {
      return { label: "Inspection Confirmed", urgency: "low", link: base };
    }
  }

  // Inspection
  if (status === "inspection_in_progress") {
    return { label: "Inspection Underway", urgency: "low", link: base };
  }

  // Submission
  if (status === "submitted" || status === "report_requested") {
    return { label: "Review Submission", urgency: "high", link: base };
  }

  // Report
  if (status === "report_drafting") {
    return { label: "Generate Report", urgency: "medium", link: base };
  }
  if (status === "report_ready") {
    return { label: "Send to Buyer", urgency: "high", link: base };
  }

  return { label: "Review Order", urgency: "medium", link: base };
}

export async function GET() {
  try {
    const result = await requireRole(["operations", "operations_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;

    const today = new Date().toISOString().split("T")[0];

    // Parallel data fetch
    const [ordersRes, payoutsRes, rcProfilesRes, availabilityRes, assignmentsRes] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, order_id, vehicle_year, vehicle_make, vehicle_model, package, status, assignment_status, payment_status, created_at, scheduled_date, assigned_ridechecker_id, current_offer, base_pay")
        .not("status", "eq", "cancelled")
        .order("created_at", { ascending: false })
        .limit(150),

      supabaseAdmin
        .from("ridechecker_payouts")
        .select("id, status, total_pay")
        .in("status", ["pending", "approved"]),

      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "ridechecker_active"),

      supabaseAdmin
        .from("ridechecker_availability")
        .select("ridechecker_id, date, start_time, end_time, max_jobs")
        .eq("date", today),

      supabaseAdmin
        .from("ridechecker_job_assignments")
        .select("ridechecker_id, status")
        .in("status", ["awaiting_acceptance", "accepted", "in_progress"]),
    ]);

    const orders: any[] = ordersRes.data ?? [];
    const payouts: any[] = payoutsRes.data ?? [];
    const rcProfiles: any[] = rcProfilesRes.data ?? [];
    const todayAvail: any[] = availabilityRes.data ?? [];
    const activeAssignments: any[] = assignmentsRes.data ?? [];

    // ── Stats ──────────────────────────────────────────────────────────
    const paidStatuses = ["paid", "paid_manual_verified"];
    const unassignedPaid = orders.filter(
      (o) => paidStatuses.includes(o.payment_status) && (!o.assignment_status || o.assignment_status === "unassigned")
    ).length;
    const awaitingRC = orders.filter((o) => o.assignment_status === "awaiting_acceptance").length;
    const activeInspections = orders.filter((o) =>
      ["accepted", "en_route", "inspection_in_progress"].includes(o.assignment_status ?? o.status)
    ).length;
    const pendingReview = orders.filter((o) =>
      o.status === "submitted" || o.status === "report_requested"
    ).length;
    const reportReady = orders.filter((o) => o.status === "report_ready").length;

    const pendingPayoutTotal = payouts
      .filter((p) => p.status === "pending")
      .reduce((s: number, p: any) => s + (p.total_pay ?? 0), 0);
    const approvedPayoutTotal = payouts
      .filter((p) => p.status === "approved")
      .reduce((s: number, p: any) => s + (p.total_pay ?? 0), 0);

    // ── Order queue with next action ───────────────────────────────────
    const orderQueue = orders
      .filter((o) => o.status !== "completed")
      .slice(0, 80)
      .map((o: any) => {
        const na = computeNextAction(o);
        return {
          id: o.id,
          order_id: o.order_id,
          vehicle: [o.vehicle_year, o.vehicle_make, o.vehicle_model].filter(Boolean).join(" "),
          package: o.package ?? null,
          status: o.status,
          assignment_status: o.assignment_status ?? "unassigned",
          payment_status: o.payment_status ?? null,
          scheduled_date: o.scheduled_date ?? null,
          created_at: o.created_at,
          next_action: na.label,
          next_action_urgency: na.urgency,
          next_action_link: na.link,
          offered_pay: o.current_offer ?? o.base_pay ?? null,
          assigned_ridechecker_id: o.assigned_ridechecker_id ?? null,
        };
      })
      // Sort: high urgency first, then by created_at
      .sort((a, b) => {
        const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2, done: 3 };
        const diff = (urgencyOrder[a.next_action_urgency] ?? 2) - (urgencyOrder[b.next_action_urgency] ?? 2);
        if (diff !== 0) return diff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    // ── RC availability panel ──────────────────────────────────────────
    const availMap: Record<string, any> = {};
    for (const slot of todayAvail) {
      availMap[slot.ridechecker_id] = slot;
    }

    const activeCountMap: Record<string, number> = {};
    for (const a of activeAssignments) {
      activeCountMap[a.ridechecker_id] = (activeCountMap[a.ridechecker_id] ?? 0) + 1;
    }

    const rcAvailability = rcProfiles.map((rc: any) => {
      const slot = availMap[rc.id];
      const activeJobs = activeCountMap[rc.id] ?? 0;
      return {
        ridechecker_id: rc.id,
        full_name: rc.full_name,
        email: rc.email,
        available_today: !!slot,
        today_start: slot?.start_time ?? null,
        today_end: slot?.end_time ?? null,
        max_jobs: slot?.max_jobs ?? null,
        active_jobs: activeJobs,
        at_capacity: slot ? activeJobs >= (slot.max_jobs ?? 3) : false,
      };
    }).sort((a: any, b: any) => {
      // Available + not at capacity first
      if (a.available_today && !a.at_capacity && !(b.available_today && !b.at_capacity)) return -1;
      if (b.available_today && !b.at_capacity && !(a.available_today && !a.at_capacity)) return 1;
      return a.full_name.localeCompare(b.full_name);
    });

    // ── Payout summary ─────────────────────────────────────────────────
    const payoutSummary = {
      pending_count: payouts.filter((p) => p.status === "pending").length,
      pending_total: pendingPayoutTotal,
      approved_count: payouts.filter((p) => p.status === "approved").length,
      approved_total: approvedPayoutTotal,
    };

    return NextResponse.json({
      stats: {
        total_active: orders.filter((o) => o.status !== "completed").length,
        unassigned_paid: unassignedPaid,
        awaiting_rc: awaitingRC,
        active_inspections: activeInspections,
        pending_review: pendingReview,
        report_ready: reportReady,
      },
      order_queue: orderQueue,
      rc_availability: rcAvailability,
      payout_summary: payoutSummary,
    });
  } catch (err: any) {
    console.error("[ops/dashboard error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
