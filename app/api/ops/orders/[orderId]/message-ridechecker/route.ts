import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  message: z.string().min(1).max(1000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { message } = parsed.data;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_id, assigned_ridechecker_id, vehicle_year, vehicle_make, vehicle_model")
      .eq("id", params.orderId)
      .maybeSingle();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!order.assigned_ridechecker_id) {
      return NextResponse.json({ error: "No RideChecker assigned to this order" }, { status: 400 });
    }

    const { data: rc } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone")
      .eq("id", order.assigned_ridechecker_id)
      .maybeSingle();

    if (!rc) return NextResponse.json({ error: "RideChecker not found" }, { status: 404 });

    const firstName = (rc.full_name || "there").split(" ")[0];
    const vehicleLabel = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;margin-bottom:20px;">
          <h1 style="color:#22774F;margin:0;font-size:24px;">RideCheck</h1>
          <p style="color:#64748b;font-size:13px;margin:4px 0 0;">Field Inspection Network</p>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin-bottom:16px;">
          <p style="font-weight:700;color:#166534;margin:0;font-size:14px;">Message from Ops Team</p>
          <p style="color:#15803d;margin:4px 0 0;font-size:12px;">Re: ${vehicleLabel}</p>
        </div>
        <p style="color:#1e293b;">Hi ${firstName},</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;color:#334155;line-height:1.7;font-size:15px;">${message.replace(/\n/g, "<br/>")}</div>
        <p style="text-align:center;margin:24px 0;">
          <a href="${appUrl}/ridechecker/dashboard" style="display:inline-block;background:#22774F;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;">Go to Dashboard</a>
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 12px;" />
        <p style="color:#94a3b8;font-size:12px;text-align:center;">RideCheck — Pre-Car-Purchase Intelligence<br/>Questions? <a href="mailto:support@ridecheckauto.com" style="color:#22774F;">support@ridecheckauto.com</a></p>
      </div>
    `;

    const results: Record<string, boolean> = { email: false, sms: false };

    if (rc.email) {
      const { sendEmail } = await import("@/lib/notifications/email");
      const r = await sendEmail({
        to: rc.email,
        subject: `Ops message — ${vehicleLabel}`,
        html: emailHtml,
      });
      results.email = r.success;
    }

    if (rc.phone) {
      const { sendSMS } = await import("@/lib/notifications/sms");
      const r = await sendSMS({
        to: rc.phone,
        body: `RideCheck Ops (${vehicleLabel}): ${message}`,
      });
      results.sms = r.success;
    }

    await writeOrderEvent({
      orderId: params.orderId,
      eventType: "ops_message_to_ridechecker",
      actorId: actor.userId,
      actorEmail: actor.email,
      details: {
        ridechecker_id: rc.id,
        ridechecker_name: rc.full_name,
        message,
        email_sent: results.email,
        sms_sent: results.sms,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
