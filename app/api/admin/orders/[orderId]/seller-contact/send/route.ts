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
  channel:            z.enum(["email", "sms"]),
  to:                 z.string().min(1, "Destination is required"),
  subject:            z.string().optional(),
  message_body:       z.string().min(1, "Message body is required"),
  template_key:       z.string().optional(),
  save_seller_email:  z.boolean().optional(),
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

    const { channel, to, subject, message_body, template_key, save_seller_email } = parsed.data;

    // ── Server-side email format validation ──
    if (channel === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to.trim())) {
        return NextResponse.json(
          { error: "Invalid email address. Enter a valid seller email or Craigslist relay email." },
          { status: 400 }
        );
      }
    }

    // ── Fetch order (payment gate + vehicle details for branded email) ──
    const { data: gateOrder } = await supabaseAdmin
      .from("orders")
      .select(
        "payment_status, payment_required, payment_override_approved, " +
        "vehicle_year, vehicle_make, vehicle_model, listing_source, preferred_date"
      )
      .eq("id", params.orderId)
      .single();

    if (!gateOrder || !canProceedWithRideCheck(gateOrder as any)) {
      return NextResponse.json({ error: PAYMENT_GATE_ERRORS.seller_outreach }, { status: 402 });
    }

    // ── Build branded HTML email body ──
    let html: string;
    if (channel === "email") {
      const { sellerOutreachEmailHtml } = await import(
        "@/lib/email/templates/sellerOutreachEmail"
      );
      const attemptRaw = await supabaseAdmin
        .from("seller_contact_attempts")
        .select("attempt_number")
        .eq("order_id", params.orderId)
        .neq("channel", "buyer_message")
        .order("attempt_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const currentAttemptNumber = ((attemptRaw.data as any)?.attempt_number ?? 0) + 1;

      html = sellerOutreachEmailHtml({
        messageBody:    message_body,
        vehicleYear:    (gateOrder as any).vehicle_year   ?? null,
        vehicleMake:    (gateOrder as any).vehicle_make   ?? null,
        vehicleModel:   (gateOrder as any).vehicle_model  ?? null,
        listingSource:  (gateOrder as any).listing_source ?? null,
        preferredDate:  (gateOrder as any).preferred_date ?? null,
        attemptNumber:  currentAttemptNumber,
      });
    } else {
      // SMS — no HTML needed, but keep a fallback for sendDirect signature
      html = message_body;
    }

    // ── Twilio StatusCallback URL for SMS delivery tracking ──
    const statusCallback =
      channel === "sms" && process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`
        : undefined;

    // ── Reply-to address for email (encodes order number so inbound parser can match) ──
    const orderRef    = (gateOrder as any)?.order_number ?? null;
    const appDomain   = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/^https?:\/\//, "").split("/")[0];
    const replyToDomain = appDomain || "ridecheckauto.com";
    const replyTo     = channel === "email" && orderRef
      ? `RideCheck Ops <replies+${orderRef}@${replyToDomain}>`
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
      { statusCallback, replyTo }
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

    // ── Update order counters + contact status (+ optionally save seller_email) ──
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("seller_contact_attempts, seller_contact_status, seller_email")
      .eq("id", params.orderId)
      .single();

    const now = new Date().toISOString();

    const orderUpdate: Record<string, unknown> = {
      seller_contact_attempts: ((order as any)?.seller_contact_attempts ?? 0) + 1,
      seller_last_contact_at:  now,
      seller_contact_status:
        !(order as any)?.seller_contact_status ||
        (order as any)?.seller_contact_status === "not_started"
          ? "attempting"
          : (order as any)?.seller_contact_status,
      updated_at: now,
    };

    // If ops pasted a new email address and checked "save to order", persist it
    if (
      save_seller_email &&
      channel === "email" &&
      to &&
      to !== (order as any)?.seller_email
    ) {
      orderUpdate.seller_email = to;
    }

    await supabaseAdmin
      .from("orders")
      .update(orderUpdate)
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
