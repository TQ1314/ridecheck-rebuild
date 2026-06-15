import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  message: z.string().min(1).max(1000),
  channel: z.enum(["email", "sms", "both"]).default("both"),
});

export async function POST(
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
    const { message, channel } = parsed.data;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, buyer_email, customer_email, buyer_phone, customer_phone, customer_name, vehicle_year, vehicle_make, vehicle_model")
      .eq("id", params.orderId)
      .maybeSingle();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const buyerEmail  = order.buyer_email || order.customer_email;
    const buyerPhone  = order.buyer_phone || order.customer_phone;
    const firstName   = (order.customer_name || "there").split(" ")[0];
    const vehicleLabel = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;

    // Build reply-to so buyer replies are routed back into RideCheck
    const appUrl    = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/^https?:\/\//, "").split("/")[0];
    const domain    = appUrl || "ridecheckauto.com";
    const orderRef  = (order as any).order_number ?? null;
    const replyTo   = orderRef
      ? `RideCheck Ops <replies+${orderRef}@${domain}>`
      : undefined;

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;margin-bottom:20px;">
          <h1 style="color:#22774F;margin:0;font-size:24px;">RideCheck</h1>
          <p style="color:#64748b;font-size:13px;margin:4px 0 0;">Pre-Car-Purchase Intelligence</p>
        </div>
        <p style="color:#1e293b;">Hi ${firstName},</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;color:#334155;line-height:1.7;font-size:15px;">${message.replace(/\n/g, "<br/>")}</div>
        <p style="color:#64748b;font-size:13px;">This update is regarding your RideCheck order for the <strong>${vehicleLabel}</strong>.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 12px;" />
        <p style="color:#94a3b8;font-size:12px;text-align:center;">RideCheck — Pre-Car-Purchase Intelligence<br/>Questions? Reply to this email or contact <a href="mailto:support@ridecheckauto.com" style="color:#22774F;">support@ridecheckauto.com</a></p>
      </div>
    `;

    const results: Record<string, boolean> = { email: false, sms: false };

    if ((channel === "email" || channel === "both") && buyerEmail) {
      const { sendEmail } = await import("@/lib/notifications/email");
      const r = await sendEmail({
        to: buyerEmail,
        subject: `Update on your RideCheck — ${vehicleLabel}`,
        html: emailHtml,
        replyTo,
      });
      results.email = r.success;
    }

    if ((channel === "sms" || channel === "both") && buyerPhone) {
      const { sendSMS } = await import("@/lib/notifications/sms");
      const r = await sendSMS({
        to: buyerPhone,
        body: `RideCheck update for your ${vehicleLabel}: ${message}`,
      });
      results.sms = r.success;
    }

    await writeOrderEvent({
      orderId: params.orderId,
      eventType: "buyer_message_sent",
      actorId: actor.userId,
      actorEmail: actor.email,
      details: { message, channel, email_sent: results.email, sms_sent: results.sms },
    }).catch(() => {});

    // Mirror to seller_messages for Communication Center feed
    try {
      await supabaseAdmin.from("seller_messages").insert({
        order_id:       params.orderId,
        channel:        channel === "both" ? (results.email ? "email" : "sms") : channel,
        direction:      "outbound",
        body:           message,
        sender_type:    "ops",
        recipient_type: "buyer",
        status:         results.email || results.sms ? "sent" : "failed",
        created_by:     actor.userId,
        is_read:        true,
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
