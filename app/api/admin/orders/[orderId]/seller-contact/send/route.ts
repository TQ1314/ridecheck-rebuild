/**
 * POST /api/admin/orders/[orderId]/seller-contact/send
 *
 * Actually sends an SMS or email to the seller with delivery tracking.
 * Creates a new seller_contact_attempts row with:
 *   - delivery_status: "queued"  (if send succeeded)
 *   - delivery_status: "failed"  (if send failed immediately)
 *   - provider_message_id from Resend / Twilio
 *
 * Separate from the existing /attempt route, which logs manual/offline attempts
 * that cannot be sent programmatically (calls, copy-paste FB messages, etc.).
 *
 * Body:
 *   channel      "email" | "sms"
 *   to           Destination email address or E.164 phone number
 *   subject      Email subject (email only)
 *   message_body Plain text message body (auto-wrapped in HTML for email)
 *   template_key Optional identifier for auditing (e.g. "sms_seller_contact_1")
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { canProceedWithRideCheck, PAYMENT_GATE_ERRORS } from "@/lib/payment/payment-gate";
import { sendDirect } from "@/lib/notifications/send-preferred";
import { z } from "zod";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  channel:      z.enum(["email", "sms"]),
  to:           z.string().min(1, "Destination is required"),
  subject:      z.string().optional(),
  message_body: z.string().min(1, "Message body is required"),
  template_key: z.string().optional(),
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
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { channel, to, subject, message_body, template_key } = parsed.data;

    // ── Payment gate ──
    const { data: gateOrder } = await supabaseAdmin
      .from("orders")
      .select("payment_status, payment_required, payment_override_approved")
      .eq("id", params.orderId)
      .single();

    if (!gateOrder || !canProceedWithRideCheck(gateOrder)) {
      return NextResponse.json({ error: PAYMENT_GATE_ERRORS.seller_outreach }, { status: 402 });
    }

    // ── Build HTML email body (preserve line breaks, add minimal wrapper) ──
    const paragraphs = message_body
      .split('\n')
      .map(line =>
        line.trim()
          ? `<p style="margin: 0 0 14px 0;">${line}</p>`
          : `<p style="margin: 0 0 14px 0;">&nbsp;</p>`
      )
      .join('');

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            max-width: 600px; margin: 0 auto; padding: 24px 32px;
            background-color: #ffffff; color: #1a1a1a; line-height: 1.65; font-size: 15px;">
  ${paragraphs}
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0 20px;" />
  <p style="font-size: 12px; color: #9ca3af; margin: 0; line-height: 1.5;">
    This message was sent by RideCheck Operations on behalf of a vehicle buyer.<br>
    Please reply directly to this email with questions or to confirm availability.
  </p>
</div>`.trim();

    // ── Twilio StatusCallback URL for SMS delivery tracking ──
    const statusCallback =
      channel === "sms" && process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`
        : undefined;

    // ── Send ──
    const r = await sendDirect(
      channel,
      to,
      {
        subject: subject || `Vehicle Inspection Request — RideCheck`,
        html,
        smsBody: message_body,
      },
      { statusCallback }
    );

    // ── Determine next attempt_number (non-buyer_message rows) ──
    const { data: maxRow } = await supabaseAdmin
      .from("seller_contact_attempts")
      .select("attempt_number")
      .eq("order_id", params.orderId)
      .neq("channel", "buyer_message")
      .order("attempt_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const attemptNumber = ((maxRow as any)?.attempt_number ?? 0) + 1;

    // ── Insert attempt row ──
    const key = template_key ?? `${channel}_seller_contact`;
    const { data: newAttempt, error: insertErr } = await supabaseAdmin
      .from("seller_contact_attempts")
      .insert({
        order_id:             params.orderId,
        attempt_number:       attemptNumber,
        channel,
        destination:          to,
        message_template_key: key,
        message_body,
        status:               r.success ? "sent" : "failed",
        delivery_status:      r.success ? "queued" : "failed",
        provider_message_id:  r.messageId ?? r.sid ?? null,
        is_auto_notification: false,
        created_by:           actor.userId,
      })
      .select("id, attempt_number")
      .single();

    if (insertErr) {
      console.error("[seller-contact/send] insert error", insertErr);
      return NextResponse.json({ error: "Failed to record attempt" }, { status: 500 });
    }

    // ── Update order counters + contact status ──
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("seller_contact_attempts, seller_contact_status")
      .eq("id", params.orderId)
      .single();

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("orders")
      .update({
        seller_contact_attempts: ((order as any)?.seller_contact_attempts ?? 0) + 1,
        seller_last_contact_at:  now,
        seller_contact_status:
          !(order as any)?.seller_contact_status ||
          (order as any)?.seller_contact_status === "not_started"
            ? "attempting"
            : (order as any)?.seller_contact_status,
        updated_at: now,
      })
      .eq("id", params.orderId);

    // ── Audit + event ──
    const details = {
      attempt_number:      attemptNumber,
      channel,
      destination:         to,
      delivery_status:     r.success ? "queued" : "failed",
      provider_message_id: r.messageId ?? r.sid ?? null,
      sent_via:            "direct_send",
    };

    await Promise.all([
      writeOrderEvent({
        orderId:    params.orderId,
        eventType:  "seller_contact_attempt",
        actorId:    actor.userId,
        actorEmail: actor.email,
        details,
      }),
      writeAuditLog({
        actorId:    actor.userId,
        actorEmail: actor.email,
        actorRole:  actor.role,
        action:     "order.seller_contact_send",
        resourceId: params.orderId,
        newValue:   details,
      }),
    ]);

    return NextResponse.json({
      success:             r.success,
      attempt_id:          (newAttempt as any)?.id,
      attempt_number:      (newAttempt as any)?.attempt_number,
      delivery_status:     r.success ? "queued" : "failed",
      provider_message_id: r.messageId ?? r.sid ?? null,
      error:               r.success ? undefined : String((r as any).error ?? "Send failed"),
    });
  } catch (err: any) {
    console.error("[seller-contact/send] unexpected error", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}
