import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ACCEPTANCE_TIMEOUT_MINUTES = 15;

const schema = z.object({
  ridechecker_id: z.string().uuid().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { ridechecker_id } = parsed.data;

    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_id, vehicle_year, vehicle_make, vehicle_model, assignment_status, current_offer, base_pay, boost_amount")
      .eq("id", params.orderId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let rcName: string | null = null;

    if (ridechecker_id) {
      const { data: rc, error: rcErr } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", ridechecker_id)
        .single();

      if (rcErr || !rc) {
        return NextResponse.json({ error: "RideChecker not found" }, { status: 404 });
      }
      if (!["ridechecker", "ridechecker_active", "owner", "developer"].includes(rc.role)) {
        return NextResponse.json({ error: "User is not a RideChecker" }, { status: 400 });
      }
      rcName = rc.full_name;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + ACCEPTANCE_TIMEOUT_MINUTES * 60 * 1000).toISOString();

    const newOrderStatus = ridechecker_id ? "awaiting_acceptance" : "unassigned";

    // Cancel any existing open assignments for this order
    // Note: ridechecker_job_assignments has no updated_at column — do not include it
    if (ridechecker_id) {
      const { error: cancelErr } = await supabaseAdmin
        .from("ridechecker_job_assignments")
        .update({ status: "cancelled" })
        .eq("order_id", params.orderId)
        .in("status", ["awaiting_acceptance", "assigned"]);
      if (cancelErr) {
        console.error("[ridechecker-assign cancel error]", cancelErr.message, cancelErr.code);
      }
    }

    // Update order
    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        assigned_ridechecker_id: ridechecker_id,
        assignment_status: newOrderStatus,
        updated_at: nowIso,
      })
      .eq("id", params.orderId);

    if (updateErr) {
      console.error("[ridechecker-assign update error]", updateErr.message, updateErr.code, updateErr.details);
      return NextResponse.json({ error: `Failed to update assignment: ${updateErr.message}` }, { status: 500 });
    }

    let assignmentId: string | null = null;

    // Create new assignment row with expires_at when assigning
    if (ridechecker_id) {
      const { data: newAssignment, error: insertErr } = await supabaseAdmin
        .from("ridechecker_job_assignments")
        .insert({
          order_id: params.orderId,
          ridechecker_id,
          status: "awaiting_acceptance",
          expires_at: expiresAt,
          created_at: nowIso,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("[ridechecker-assign insert error]", insertErr);
        // Roll back the order update so ops and RC stay in sync
        await supabaseAdmin
          .from("orders")
          .update({ assigned_ridechecker_id: null, assignment_status: "unassigned", updated_at: nowIso })
          .eq("id", params.orderId);
        return NextResponse.json(
          { error: `Failed to create job assignment record: ${insertErr.message}` },
          { status: 500 }
        );
      } else {
        assignmentId = newAssignment?.id ?? null;
      }

      // Expire any open broadcasts
      await supabaseAdmin
        .from("job_broadcasts")
        .update({ status: "expired", updated_at: nowIso })
        .eq("order_id", params.orderId)
        .eq("status", "sent");
    }

    // Notify the RideChecker via SMS + email when assigned
    if (ridechecker_id && assignmentId) {
      try {
        const { data: rc } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, phone")
          .eq("id", ridechecker_id)
          .maybeSingle();

        if (rc) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";
          const vehicleLabel = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;
          const pay = order.current_offer ?? order.base_pay ?? null;
          const firstName = (rc.full_name || "there").split(" ")[0];
          const jobUrl = `${appUrl}/ridechecker/dashboard`;

          const smsBody = `RideCheck: Hi ${firstName}, a new job has been assigned to you${pay ? ` ($${pay})` : ""} — ${vehicleLabel}. You have 15 minutes to accept. Check your dashboard: ${jobUrl}`;

          const emailHtml = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <div style="text-align:center;margin-bottom:20px;">
                <h1 style="color:#22774F;margin:0;font-size:24px;">RideCheck</h1>
                <p style="color:#64748b;font-size:13px;margin:4px 0 0;">Field Inspection Network</p>
              </div>
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:18px;margin-bottom:20px;">
                <p style="font-weight:700;color:#166534;margin:0 0 4px;font-size:16px;">New job assigned to you</p>
                <p style="color:#15803d;margin:0;font-size:13px;">You have 15 minutes to accept. Act fast.</p>
              </div>
              <p style="color:#1e293b;">Hi ${firstName},</p>
              <p style="color:#475569;line-height:1.6;">A vehicle assessment job for a <strong>${vehicleLabel}</strong>${pay ? ` at <strong>$${pay}</strong>` : ""} has been assigned directly to you. Log in to your dashboard to review the details and accept.</p>
              <p style="text-align:center;margin:24px 0;">
                <a href="${jobUrl}" style="display:inline-block;background:#22774F;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:700;">View &amp; Accept Job</a>
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 12px;" />
              <p style="color:#94a3b8;font-size:12px;text-align:center;">RideCheck — Pre-Car-Purchase Intelligence<br/>Questions? <a href="mailto:support@ridecheckauto.com" style="color:#22774F;">support@ridecheckauto.com</a></p>
            </div>
          `;

          const notifs: Promise<any>[] = [];
          if (rc.phone) {
            const { sendSMS } = await import("@/lib/notifications/sms");
            notifs.push(sendSMS({ to: rc.phone, body: smsBody }));
          }
          if (rc.email) {
            const { sendEmail } = await import("@/lib/notifications/email");
            notifs.push(sendEmail({
              to: rc.email,
              subject: `New RideCheck Job — Action Required: ${vehicleLabel}`,
              html: emailHtml,
            }));
          }
          await Promise.allSettled(notifs);
        }
      } catch (notifErr) {
        console.error("[ridechecker-assign notify error]", notifErr);
      }
    }

    await Promise.allSettled([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: ridechecker_id ? "ridechecker_assigned" : "ridechecker_unassigned",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: {
          ridechecker_id: ridechecker_id ?? null,
          ridechecker_name: rcName,
          assignment_id: assignmentId,
          expires_at: ridechecker_id ? expiresAt : null,
        },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: ridechecker_id ? "order.ridechecker_assigned" : "order.ridechecker_unassigned",
        resourceId: params.orderId,
        newValue: {
          ridechecker_id: ridechecker_id ?? null,
          assignment_status: newOrderStatus,
          expires_at: ridechecker_id ? expiresAt : null,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      assignment_status: newOrderStatus,
      assignment_id: assignmentId,
      expires_at: ridechecker_id ? expiresAt : null,
      timeout_minutes: ACCEPTANCE_TIMEOUT_MINUTES,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
