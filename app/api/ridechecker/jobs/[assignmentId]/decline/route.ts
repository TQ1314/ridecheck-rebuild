import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeOrderEvent } from "@/lib/rbac";

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
      .select("role, full_name, email")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker_active", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: assignment, error: fetchError } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .select("id, status, order_id")
      .eq("id", params.assignmentId)
      .eq("ridechecker_id", session.user.id)
      .maybeSingle();

    if (fetchError || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const declinableStatuses = ["awaiting_acceptance", "assigned", "accepted"];
    if (!declinableStatuses.includes(assignment.status)) {
      return NextResponse.json(
        { error: "Assignment cannot be declined in its current status" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const reason = body.reason || "declined_by_ridechecker";
    const note = body.note || null;

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .update({
        status: "declined",
        rejection_reason: `${reason}${note ? `: ${note}` : ""}`,
        rejected_at: now,
        declined_at: now,
      })
      .eq("id", assignment.id);

    if (updateError) {
      console.error("[decline assignment error]", updateError);
      return NextResponse.json({ error: "Failed to decline assignment" }, { status: 500 });
    }

    // Free the order back to unassigned so ops can reassign
    await supabaseAdmin
      .from("orders")
      .update({
        assignment_status: "unassigned",
        assigned_ridechecker_id: null,
        updated_at: now,
      })
      .eq("id", assignment.order_id);

    // Write order event
    await writeOrderEvent({
      orderId: assignment.order_id,
      eventType: "ridechecker_declined",
      actorId: session.user.id,
      actorEmail: profile.email ?? session.user.email ?? "",
      details: {
        assignment_id: assignment.id,
        ridechecker_name: profile.full_name ?? null,
        reason,
        note: note ?? null,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[decline assignment error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
