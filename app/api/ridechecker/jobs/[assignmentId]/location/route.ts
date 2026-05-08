import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  const result = await requireRole(["ridechecker_active", "owner"]);
  if (!isAuthorized(result)) return result.error;

  const { assignmentId } = params;
  const body = await req.json().catch(() => ({}));
  const { lat, lng } = body as { lat?: unknown; lng?: unknown };

  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat and lng must be numbers" }, { status: 400 });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const { data: assignment, error: fetchErr } = await supabaseAdmin
    .from("ridechecker_job_assignments")
    .select("id, ridechecker_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (fetchErr || !assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  if (result.actor.role !== "owner" && assignment.ridechecker_id !== result.actor.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("ridechecker_job_assignments")
    .update({
      last_known_lat: lat,
      last_known_lng: lng,
      last_location_update_at: new Date().toISOString(),
    })
    .eq("id", assignmentId);

  if (error) {
    console.error("[location PATCH error]", error);
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
