import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    // Find the active awaiting_acceptance assignment
    const { data: assignment, error: aErr } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .select("id, ridechecker_id, expires_at, status")
      .eq("order_id", params.orderId)
      .eq("status", "awaiting_acceptance")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (aErr || !assignment) {
      return NextResponse.json(
        { error: "No pending assignment found for this order." },
        { status: 404 }
      );
    }

    // Check if still within the acceptance window
    if (assignment.expires_at && new Date(assignment.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Acceptance window has expired. Cancel and reassign instead." },
        { status: 400 }
      );
    }

    // Get RC contact details + order info
    const [{ data: rc }, { data: order }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, phone")
        .eq("id", assignment.ridechecker_id)
        .maybeSingle(),
      supabaseAdmin
        .from("orders")
        .select("order_id, vehicle_year, vehicle_make, vehicle_model, base_pay, current_offer")
        .eq("id", params.orderId)
        .maybeSingle(),
    ]);

    if (!rc) {
      return NextResponse.json({ error: "RideChecker not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";
    const vehicleLabel = order
      ? `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`
      : "Vehicle";
    const pay = order?.current_offer ?? order?.base_pay ?? null;
    const firstName = (rc.full_name || "there").split(" ")[0];
    const minsLeft = assignment.expires_at
      ? Math.max(0, Math.floor((new Date(assignment.expires_at).getTime() - Date.now()) / 60000))
      : null;
    const jobUrl = `${appUrl}/ridechecker/dashboard`;

    const smsBody = `RideCheck: Hi ${firstName}, you have a job offer waiting${pay ? ` ($${pay})` : ""} for a ${vehicleLabel}.${minsLeft !== null ? ` ~${minsLeft} min left to accept.` : ""} Check your dashboard: ${jobUrl}`;

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;margin-bottom:20px;">
          <h1 style="color:#22774F;margin:0;font-size:24px;">RideCheck</h1>
          <p style="color:#64748b;font-size:13px;margin:4px 0 0;">Field Inspection Network</p>
        </div>
        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="font-weight:700;color:#92400e;margin:0 0 4px;font-size:15px;">⏰ Reminder — Job offer still awaiting your response</p>
          ${minsLeft !== null ? `<p style="color:#b45309;margin:0;font-size:13px;">Approximately ${minsLeft} minute${minsLeft === 1 ? "" : "s"} remaining.</p>` : ""}
        </div>
        <p style="color:#1e293b;">Hi ${firstName},</p>
        <p style="color:#475569;line-height:1.6;">We noticed you haven't responded yet to the job offer for a <strong>${vehicleLabel}</strong>${pay ? ` at <strong>$${pay}</strong>` : ""}. Please log in and respond before the window closes.</p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${jobUrl}" style="display:inline-block;background:#22774F;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:700;">View Job &amp; Respond</a>
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 12px;" />
        <p style="color:#94a3b8;font-size:12px;text-align:center;">RideCheck — Pre-Car-Purchase Intelligence<br/>Questions? <a href="mailto:support@ridecheckauto.com" style="color:#22774F;">support@ridecheckauto.com</a></p>
      </div>
    `;

    const now = new Date().toISOString();

    const notifications = [];

    if (rc.phone) {
      const { sendSMS } = await import("@/lib/notifications/sms");
      notifications.push(sendSMS({ to: rc.phone, body: smsBody }));
    }

    if (rc.email) {
      const { sendEmail } = await import("@/lib/notifications/email");
      notifications.push(
        sendEmail({
          to: rc.email,
          subject: `Reminder: Job offer waiting for you — ${vehicleLabel}`,
          html: emailHtml,
        })
      );
    }

    await Promise.allSettled(notifications);

    // Stamp last_nudge_at on the assignment
    await supabaseAdmin
      .from("ridechecker_job_assignments")
      .update({ last_nudge_at: now })
      .eq("id", assignment.id);

    await Promise.allSettled([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "ridechecker_nudged",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: {
          ridechecker_id: rc.id,
          ridechecker_name: rc.full_name,
          sms_sent: !!rc.phone,
          email_sent: !!rc.email,
        },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.ridechecker_nudged",
        resourceId: params.orderId,
        newValue: { ridechecker_id: rc.id, nudged_at: now },
      }),
    ]);

    return NextResponse.json({
      success: true,
      sms_sent: !!rc.phone,
      email_sent: !!rc.email,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
