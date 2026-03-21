import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const supabase = createRouteHandlerSupabaseClient();
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

    if (!profile || !["ridechecker_active", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: assignment, error: fetchError } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .select("id, status, order_id, scheduled_start")
      .eq("id", params.assignmentId)
      .eq("ridechecker_id", session.user.id)
      .maybeSingle();

    if (fetchError || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    if (!["accepted", "in_progress"].includes(assignment.status)) {
      return NextResponse.json(
        { error: "ETA can only be updated for accepted or in-progress assignments" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const delayMins = typeof body.delay_mins === "number" ? body.delay_mins : null;

    if (delayMins === null || delayMins < 0 || delayMins > 480) {
      return NextResponse.json(
        { error: "delay_mins must be a number between 0 and 480" },
        { status: 400 }
      );
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: session.user.id,
      actor_email: session.user.email,
      actor_role: profile.role,
      action: "ridechecker.eta_update",
      resource_id: assignment.id,
      metadata: {
        order_id: assignment.order_id,
        delay_mins: delayMins,
        scheduled_start: assignment.scheduled_start,
      },
    });

    console.log(`[ETA update] assignment=${assignment.id} delay=${delayMins}min by=${session.user.email}`);

    return NextResponse.json({ success: true, delay_mins: delayMins });
  } catch (err: any) {
    console.error("[eta update error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
