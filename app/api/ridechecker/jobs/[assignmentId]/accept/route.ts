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
      .select("id, status, order_id, expires_at")
      .eq("id", params.assignmentId)
      .eq("ridechecker_id", session.user.id)
      .maybeSingle();

    if (fetchError || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const acceptableStatuses = ["awaiting_acceptance", "assigned"];
    if (!acceptableStatuses.includes(assignment.status)) {
      return NextResponse.json(
        { error: "Assignment cannot be accepted in its current status" },
        { status: 400 }
      );
    }

    // Check expiry
    if (assignment.expires_at) {
      const expiresAt = new Date(assignment.expires_at);
      if (expiresAt < new Date()) {
        // Mark as expired
        await supabaseAdmin
          .from("ridechecker_job_assignments")
          .update({ status: "expired" })
          .eq("id", assignment.id);

        return NextResponse.json(
          { error: "This assignment has expired. Please contact ops to be reassigned." },
          { status: 410 }
        );
      }
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .update({
        status: "accepted",
        accepted_at: now,
      })
      .eq("id", assignment.id);

    if (updateError) {
      console.error("[accept assignment error]", updateError);
      return NextResponse.json({ error: "Failed to accept assignment" }, { status: 500 });
    }

    // Update order assignment_status
    await supabaseAdmin
      .from("orders")
      .update({ assignment_status: "accepted", updated_at: now })
      .eq("id", assignment.order_id);

    // Write order event
    await writeOrderEvent({
      orderId: assignment.order_id,
      eventType: "ridechecker_accepted",
      actorId: session.user.id,
      actorEmail: profile.email ?? session.user.email ?? "",
      details: {
        assignment_id: assignment.id,
        ridechecker_name: profile.full_name ?? null,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[accept assignment error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
