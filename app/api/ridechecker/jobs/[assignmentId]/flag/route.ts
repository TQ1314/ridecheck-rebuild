import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeOrderEvent } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const FLAG_TYPES = [
  "unsafe_location",
  "hostile_seller",
  "VIN_mismatch",
  "suspected_fraud",
  "police_issue",
  "inaccessible_vehicle",
  "weather_delay",
  "vehicle_not_present",
] as const;

type FlagType = (typeof FLAG_TYPES)[number];

// Flags that freeze the assignment workflow
const HOLD_FLAGS: FlagType[] = ["unsafe_location", "suspected_fraud", "VIN_mismatch", "police_issue"];

function holdStatusForFlag(flagType: FlagType): string | null {
  if (flagType === "suspected_fraud" || flagType === "VIN_mismatch") return "fraud_hold";
  if (flagType === "unsafe_location" || flagType === "police_issue") return "unsafe_hold";
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, role, full_name, email")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker", "ridechecker_active", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch and verify assignment belongs to this RC
    const { data: assignment, error: fetchErr } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .select("id, status, order_id, ridechecker_id")
      .eq("id", params.assignmentId)
      .eq("ridechecker_id", session.user.id)
      .maybeSingle();

    if (fetchErr || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const activeStatuses = ["accepted", "en_route", "arrived", "inspecting", "inspection_started"];
    if (!activeStatuses.includes(assignment.status)) {
      return NextResponse.json(
        { error: "Issue flags can only be raised on active assignments" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const flagType: FlagType = body.flag_type;
    const notes: string | undefined = body.notes;

    if (!flagType || !FLAG_TYPES.includes(flagType)) {
      return NextResponse.json(
        { error: `flag_type must be one of: ${FLAG_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const holdStatus = holdStatusForFlag(flagType);

    // Update assignment with flag info (and optionally hold status)
    const assignmentUpdate: Record<string, unknown> = {
      flag_type: flagType,
      flag_notes: notes ?? null,
      flagged_at: now,
    };
    if (holdStatus) {
      assignmentUpdate.status = holdStatus;
    }

    const { error: updateErr } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .update(assignmentUpdate)
      .eq("id", assignment.id);

    if (updateErr) {
      console.error("[flag route update error]", updateErr);
      return NextResponse.json({ error: "Failed to record flag" }, { status: 500 });
    }

    // Write order event
    await writeOrderEvent({
      orderId: assignment.order_id,
      eventType: "issue_flagged",
      actorId: session.user.id,
      actorEmail: profile.email ?? session.user.email ?? "",
      details: {
        assignment_id: assignment.id,
        ridechecker_name: profile.full_name ?? null,
        flag_type: flagType,
        notes: notes ?? null,
        workflow_frozen: holdStatus !== null,
        new_status: holdStatus ?? assignment.status,
      },
    }).catch(() => {});

    // Notify ops immediately
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";

      if (adminEmail) {
        const { sendEmail } = await import("@/lib/notifications/email");
        const urgencyColor = HOLD_FLAGS.includes(flagType) ? "#dc2626" : "#d97706";
        const urgencyLabel = HOLD_FLAGS.includes(flagType) ? "🚨 URGENT — Workflow Frozen" : "⚠️ Issue Flagged";

        await sendEmail({
          to: adminEmail,
          subject: `[${urgencyLabel}] ${flagType.replace(/_/g, " ")} — RideChecker ${profile.full_name}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2 style="color:${urgencyColor};">${urgencyLabel}</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:6px 0;color:#64748b;">RideChecker</td><td style="padding:6px 0;font-weight:600;">${profile.full_name} (${profile.email})</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Flag Type</td><td style="padding:6px 0;font-weight:600;">${flagType.replace(/_/g, " ")}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Assignment</td><td style="padding:6px 0;">${assignment.id}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Order</td><td style="padding:6px 0;">${assignment.order_id}</td></tr>
                ${holdStatus ? `<tr><td style="padding:6px 0;color:#64748b;">Workflow</td><td style="padding:6px 0;color:${urgencyColor};font-weight:700;">FROZEN — Status: ${holdStatus}</td></tr>` : ""}
                ${notes ? `<tr><td style="padding:6px 0;color:#64748b;">Notes</td><td style="padding:6px 0;">${notes}</td></tr>` : ""}
              </table>
              <div style="margin-top:20px;">
                <a href="${appUrl}/operations/orders/${assignment.order_id}" style="display:inline-block;background:#22774F;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;">Review in Ops Panel</a>
              </div>
            </div>
          `,
        }).catch(() => {});
      }
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      flag_type: flagType,
      workflow_frozen: holdStatus !== null,
      new_status: holdStatus ?? assignment.status,
    });
  } catch (err: any) {
    console.error("[flag assignment error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
