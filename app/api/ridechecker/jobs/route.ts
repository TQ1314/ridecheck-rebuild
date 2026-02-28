import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SAFE_COLUMNS = "order_id, vehicle_year, vehicle_make, vehicle_model, vehicle_location, inspection_address, scheduled_date, scheduled_time, inspector_status, report_status, package, booking_type, created_at";

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
        .select(SAFE_COLUMNS)
        .eq("assigned_inspector_id", inspector.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        jobs = data;
      }
    }

    try {
      const { data: assignmentData } = await supabaseAdmin
        .from("ridechecker_job_assignments")
        .select("id, order_id, status, scheduled_start, scheduled_end, accepted_at, started_at, submitted_at, approved_at, rejected_at, rejection_reason, job_score, payout_amount, payout_status, created_at")
        .eq("ridechecker_id", session.user.id)
        .order("created_at", { ascending: false });

      if (assignmentData) {
        const orderIds = assignmentData.map((a: any) => a.order_id);
        if (orderIds.length > 0) {
          const { data: orderData } = await supabaseAdmin
            .from("orders")
            .select(SAFE_COLUMNS + ", id")
            .in("id", orderIds);

          const orderMap: Record<string, any> = {};
          if (orderData) {
            for (const o of orderData as any[]) {
              orderMap[o.id] = o;
            }
          }

          assignments = assignmentData.map((a: any) => ({
            ...a,
            order: orderMap[a.order_id] || null,
          }));
        }
      }
    } catch {
    }

    const activeStatuses = ["en_route", "on_site", "inspecting", "wrapping_up"];
    const stats = {
      totalJobs: jobs.length + assignments.length,
      activeJobs: jobs.filter((j) => activeStatuses.includes(j.inspector_status)).length + assignments.filter((a: any) => ["accepted", "in_progress"].includes(a.status)).length,
      completedJobs: jobs.filter((j) => j.inspector_status === "completed").length + assignments.filter((a: any) => ["approved", "paid"].includes(a.status)).length,
      pendingUpload: jobs.filter(
        (j) => j.inspector_status === "completed" && (!j.report_status || j.report_status === "pending_upload")
      ).length,
    };

    return NextResponse.json({ jobs, assignments, stats });
  } catch (err: any) {
    console.error("RideChecker jobs error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
