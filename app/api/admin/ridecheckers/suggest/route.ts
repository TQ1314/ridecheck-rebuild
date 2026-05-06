import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const result = await requireRole(["owner", "operations_lead", "operations"]);
  if (!isAuthorized(result)) return result.error;

  const { searchParams } = new URL(req.url);
  const serviceArea = searchParams.get("area") || "";
  const orderId = searchParams.get("orderId") || "";

  const { data: activeRidecheckers, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, phone, service_area, ridechecker_rating, referral_code, ridechecker_max_daily_jobs")
    .eq("role", "ridechecker_active")
    .eq("is_active", true)
    .order("ridechecker_rating", { ascending: false });

  if (error) {
    console.error("[suggest ridecheckers error]", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  if (!activeRidecheckers || activeRidecheckers.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  const rcIds = activeRidecheckers.map((rc: any) => rc.id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [activeJobsRes, declinesRes] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("assigned_inspector_id")
      .in("assigned_inspector_id", rcIds)
      .not("inspector_status", "eq", "completed")
      .not("ops_status", "in", '("completed","cancelled","delivered")'),
    supabaseAdmin
      .from("ridechecker_job_assignments")
      .select("ridechecker_id")
      .in("ridechecker_id", rcIds)
      .eq("status", "declined")
      .gte("declined_at", thirtyDaysAgo),
  ]);

  const loadMap: Record<string, number> = {};
  if (activeJobsRes.data) {
    for (const job of activeJobsRes.data) {
      if (job.assigned_inspector_id) {
        loadMap[job.assigned_inspector_id] = (loadMap[job.assigned_inspector_id] || 0) + 1;
      }
    }
  }

  const declineMap: Record<string, number> = {};
  if (declinesRes.data) {
    for (const row of declinesRes.data) {
      if (row.ridechecker_id) {
        declineMap[row.ridechecker_id] = (declineMap[row.ridechecker_id] || 0) + 1;
      }
    }
  }

  const scored = activeRidecheckers.map((rc: any) => {
    let score = 0;
    const currentLoad = loadMap[rc.id] || 0;
    const declineCount = declineMap[rc.id] || 0;

    if (serviceArea && rc.service_area) {
      const area = rc.service_area.toLowerCase();
      const target = serviceArea.toLowerCase();
      if (area.includes(target) || target.includes(area)) {
        score += 50;
      }
    }

    const rating = parseFloat(rc.ridechecker_rating) || 5.0;
    score += rating * 5;

    score -= currentLoad * 10;
    score -= declineCount * 8; // penalize frequent decliners

    return {
      id: rc.id,
      full_name: rc.full_name,
      email: rc.email,
      phone: rc.phone,
      service_area: rc.service_area,
      rating,
      active_jobs: currentLoad,
      max_daily_jobs: rc.ridechecker_max_daily_jobs ?? 5,
      decline_count_30d: declineCount,
      score,
    };
  });

  scored.sort((a: any, b: any) => b.score - a.score);

  return NextResponse.json({ suggestions: scored });
}
