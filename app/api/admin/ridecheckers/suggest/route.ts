import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Layered selects: each tier falls back if columns are missing
const FULL_SELECT    = "id, full_name, email, phone, service_area, ridechecker_rating, ridechecker_score, referral_code, ridechecker_max_daily_jobs, is_available, availability_updated_at, availability_status, suspended_until";
const SCORE_SELECT   = "id, full_name, email, phone, service_area, ridechecker_rating, ridechecker_score, referral_code, ridechecker_max_daily_jobs";
const MINIMAL_SELECT = "id, full_name, email, phone, service_area, ridechecker_rating, referral_code, ridechecker_max_daily_jobs";

async function fetchProfiles(select: string) {
  return supabaseAdmin
    .from("profiles")
    .select(select)
    .eq("role", "ridechecker_active")
    .eq("is_active", true)
    .order("ridechecker_rating", { ascending: false });
}

export async function GET(req: NextRequest) {
  const result = await requireRole(["owner", "operations_lead", "ops_lead", "operations"]);
  if (!isAuthorized(result)) return result.error;

  const { searchParams } = new URL(req.url);
  const serviceArea = searchParams.get("area") || "";

  let activeRidecheckers: any[] = [];
  let availabilityColumnsPresent = true;
  let scoreColumnPresent = true;

  // Tier 1: full columns (avail + score)
  const { data: d1, error: e1 } = await fetchProfiles(FULL_SELECT);
  if (!e1) {
    activeRidecheckers = d1 ?? [];
  } else if (e1.code === "42703") {
    // Tier 2: score only (no avail columns)
    availabilityColumnsPresent = false;
    const { data: d2, error: e2 } = await fetchProfiles(SCORE_SELECT);
    if (!e2) {
      activeRidecheckers = d2 ?? [];
    } else if (e2.code === "42703") {
      // Tier 3: minimal (no score, no avail columns)
      scoreColumnPresent = false;
      const { data: d3, error: e3 } = await fetchProfiles(MINIMAL_SELECT);
      if (e3) {
        console.error("[suggest ridecheckers error]", e3);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
      }
      activeRidecheckers = d3 ?? [];
    } else {
      console.error("[suggest ridecheckers error]", e2);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
  } else {
    console.error("[suggest ridecheckers error]", e1);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  if (activeRidecheckers.length === 0) {
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
  for (const job of activeJobsRes.data ?? []) {
    if (job.assigned_inspector_id) {
      loadMap[job.assigned_inspector_id] = (loadMap[job.assigned_inspector_id] || 0) + 1;
    }
  }

  const declineMap: Record<string, number> = {};
  for (const row of declinesRes.data ?? []) {
    if (row.ridechecker_id) {
      declineMap[row.ridechecker_id] = (declineMap[row.ridechecker_id] || 0) + 1;
    }
  }

  const scored = activeRidecheckers.map((rc: any) => {
    let score = 0;
    const currentLoad = loadMap[rc.id] || 0;
    const declineCount = declineMap[rc.id] || 0;

    if (serviceArea && rc.service_area) {
      const area = rc.service_area.toLowerCase();
      const target = serviceArea.toLowerCase();
      if (area.includes(target) || target.includes(area)) score += 50;
    }

    const rating = parseFloat(rc.ridechecker_rating) || 5.0;
    score += rating * 5;
    score -= currentLoad * 10;
    score -= declineCount * 8;

    const isAvailable = availabilityColumnsPresent ? (rc.is_available ?? false) : false;
    const availStatus: string = availabilityColumnsPresent ? (rc.availability_status ?? "available") : "available";
    const suspendedUntil: string | null = availabilityColumnsPresent ? (rc.suspended_until ?? null) : null;

    const isSuspended = availStatus === "suspended" &&
      suspendedUntil !== null &&
      new Date(suspendedUntil) > new Date();
    if (isSuspended) score -= 1000;

    return {
      id: rc.id,
      full_name: rc.full_name,
      email: rc.email,
      phone: rc.phone,
      service_area: rc.service_area,
      rating,
      ridechecker_score: scoreColumnPresent ? (rc.ridechecker_score ?? 0) : 0,
      active_jobs: currentLoad,
      max_daily_jobs: rc.ridechecker_max_daily_jobs ?? 5,
      decline_count_30d: declineCount,
      score,
      is_available: isAvailable,
      availability_status: availStatus,
      suspended_until: suspendedUntil,
      is_suspended: isSuspended,
      availability_updated_at: availabilityColumnsPresent ? (rc.availability_updated_at ?? null) : null,
    };
  });

  scored.sort((a: any, b: any) => b.score - a.score);

  return NextResponse.json({ suggestions: scored });
}
