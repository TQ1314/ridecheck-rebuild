import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeOrderEvent } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const AVAIL_SUSPEND_THRESHOLD = 3; // declines in 30 days → availability_status=suspended for 72h
const HARD_SUSPEND_THRESHOLD = 5;  // declines in 30 days → role downgrade (hard floor, unchanged)

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
      .select("id, role, full_name, email, workflow_stage")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker", "ridechecker_active", "owner"].includes(profile.role)) {
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

    // Mark assignment declined
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
      return NextResponse.json({ error: "Failed to decline assignment" }, { status: 500 });
    }

    // Free the order back to unassigned
    await supabaseAdmin
      .from("orders")
      .update({ assignment_status: "unassigned", assigned_ridechecker_id: null, updated_at: now })
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

    // ── Decline threshold enforcement ─────────────────────────────────────
    // Only enforce for active RideCheckers (not owners/devs)
    if (profile.role === "ridechecker_active") {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { count: monthlyDeclines } = await supabaseAdmin
          .from("ridechecker_job_assignments")
          .select("id", { count: "exact", head: true })
          .eq("ridechecker_id", session.user.id)
          .eq("status", "declined")
          .gte("declined_at", thirtyDaysAgo);

        const declineCount = (monthlyDeclines ?? 0) + 1; // +1 for the one we just recorded
        const firstName = (profile.full_name || "there").split(" ")[0];
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";
        const adminEmail = process.env.ADMIN_EMAIL;

        if (declineCount >= HARD_SUSPEND_THRESHOLD) {
          // Hard floor: downgrade role + set workflow_stage (unchanged behavior)
          await supabaseAdmin
            .from("profiles")
            .update({
              role: "ridechecker",
              workflow_stage: "suspended",
              suspended_at: now,
              availability_status: "suspended",
            })
            .eq("id", session.user.id);

          if (profile.email) {
            const { sendEmail } = await import("@/lib/notifications/email");
            await sendEmail({
              to: profile.email,
              subject: "Your RideCheck account has been suspended",
              html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                  <h1 style="color:#22774F;font-size:22px;">RideCheck</h1>
                  <p>Hi ${firstName},</p>
                  <p>Your RideCheck account has been <strong>automatically suspended</strong> because you have declined ${declineCount} jobs in the past 30 days (limit: ${HARD_SUSPEND_THRESHOLD}).</p>
                  <p>If you believe this is an error or would like to discuss reinstatement, please contact us at <a href="mailto:support@ridecheckauto.com">support@ridecheckauto.com</a>.</p>
                  <p style="color:#64748b;font-size:13px;">RideCheck Operations Team</p>
                </div>
              `,
            }).catch(() => {});
          }

          if (adminEmail) {
            const { sendEmail } = await import("@/lib/notifications/email");
            await sendEmail({
              to: adminEmail,
              subject: `[Auto-Suspend] RideChecker ${profile.full_name} exceeded decline limit`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                  <h2 style="color:#dc2626;">Auto-Suspension Triggered</h2>
                  <p><strong>${profile.full_name}</strong> (${profile.email}) has been automatically suspended.</p>
                  <p>Reason: ${declineCount} job declines in the past 30 days (threshold: ${HARD_SUSPEND_THRESHOLD}).</p>
                  <p><a href="${appUrl}/admin/ridecheckers">Review in Admin Panel</a></p>
                </div>
              `,
            }).catch(() => {});
          }

        } else if (declineCount === AVAIL_SUSPEND_THRESHOLD) {
          // Availability suspension: set suspended for 72h (does NOT touch role)
          const suspendedUntil = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
          await supabaseAdmin
            .from("profiles")
            .update({ availability_status: "suspended", suspended_until: suspendedUntil })
            .eq("id", session.user.id);

          if (profile.email) {
            const { sendEmail } = await import("@/lib/notifications/email");
            const restoreDate = new Date(suspendedUntil).toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
            });
            await sendEmail({
              to: profile.email,
              subject: "Your RideCheck availability has been temporarily paused",
              html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                  <h1 style="color:#22774F;font-size:22px;">RideCheck</h1>
                  <p>Hi ${firstName},</p>
                  <p>Your RideChecker access has been <strong>temporarily paused</strong> due to repeated declined assignments. You have declined ${declineCount} jobs within the past 30 days.</p>
                  <p>Access restores automatically on <strong>${restoreDate}</strong>.</p>
                  <p>If you're experiencing scheduling or availability issues, please update your availability settings when access is restored so we can route jobs appropriately.</p>
                  <p>If you believe this is an error, contact us at <a href="mailto:support@ridecheckauto.com">support@ridecheckauto.com</a>.</p>
                  <p style="color:#64748b;font-size:13px;">RideCheck Operations Team</p>
                </div>
              `,
            }).catch(() => {});
          }

          if (adminEmail) {
            const { sendEmail } = await import("@/lib/notifications/email");
            await sendEmail({
              to: adminEmail,
              subject: `[Avail-Suspend] RideChecker ${profile.full_name} — 72h availability pause`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                  <h2 style="color:#d97706;">Availability Suspension Triggered</h2>
                  <p><strong>${profile.full_name}</strong> (${profile.email}) has been availability-suspended for 72h.</p>
                  <p>Reason: ${declineCount} job declines in the past 30 days (threshold: ${AVAIL_SUSPEND_THRESHOLD}).</p>
                  <p>Role unchanged. Availability restores automatically. Ops/owner can clear manually.</p>
                  <p><a href="${appUrl}/admin/ridecheckers">Review in Admin Panel</a></p>
                </div>
              `,
            }).catch(() => {});
          }
        }
      } catch (enforcementErr) {
        // Non-fatal — don't fail the decline response
        console.error("[decline enforcement error]", enforcementErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[decline assignment error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
