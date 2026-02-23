import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/sms/twilio";
import { sendEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_phone, buyer_email, payment_status, vehicle_year, vehicle_make, vehicle_model, package, booking_type, final_price, payment_link_token")
      .eq("id", params.orderId)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.payment_status === "paid") {
      return NextResponse.json({ error: "Order already paid" }, { status: 400 });
    }

    const phone = order.buyer_phone;
    const email = order.buyer_email;

    if (!phone && !email) {
      return NextResponse.json({ error: "No contact method available" }, { status: 400 });
    }

    const token = order.payment_link_token || crypto.randomUUID();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const payUrl = `${appUrl}/pay/${order.id}?t=${token}`;
    const vehicleLabel = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;

    let channel: "sms" | "email" = "sms";
    let sentTo = phone;

    if (phone) {
      await sendSMS({
        to: phone,
        body: `RideCheck: Confirm your inspection for ${vehicleLabel}. Pay securely here: ${payUrl}`,
      });
      channel = "sms";
      sentTo = phone;
    } else if (email) {
      const price = Number(order.final_price || 0);
      await sendEmail({
        to: email,
        subject: "RideCheck payment link for your inspection",
        html: `<p>Hi! Your RideCheck inspection for <strong>${vehicleLabel}</strong> is ready for payment.</p><p>Price: <strong>$${price}</strong></p><p><a href="${payUrl}" style="display:inline-block;padding:12px 24px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Pay Now</a></p><p>Or copy this link: ${payUrl}</p>`,
      });
      channel = "email";
      sentTo = email;
    }

    await supabaseAdmin
      .from("orders")
      .update({
        payment_link_token: token,
        payment_link_sent_to: sentTo,
        payment_link_sent_channel: channel,
        payment_link_sent_at: new Date().toISOString(),
      })
      .eq("id", params.orderId);

    return NextResponse.json({ ok: true, channel });
  } catch (err: any) {
    console.error("[Send Payment Link Error]", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
