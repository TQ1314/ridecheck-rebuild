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

    const activeStatuses = ["en_route", "on_site", "inspecting", "wrapping_up"];
    const stats = {
      totalJobs: jobs.length,
      activeJobs: jobs.filter((j) => activeStatuses.includes(j.inspector_status)).length,
      completedJobs: jobs.filter((j) => j.inspector_status === "completed").length,
      pendingUpload: jobs.filter(
        (j) => j.inspector_status === "completed" && (!j.report_status || j.report_status === "pending_upload")
      ).length,
    };

    return NextResponse.json({ jobs, stats });
  } catch (err: any) {
    console.error("RideChecker jobs error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
