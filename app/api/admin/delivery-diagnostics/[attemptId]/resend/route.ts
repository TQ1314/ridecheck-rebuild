/**
 * POST /api/admin/delivery-diagnostics/[attemptId]/resend
 *
 * Retries sending a seller contact attempt that failed, bounced, or was undeliverable.
 * Creates a new attempt row with delivery tracking. Does NOT modify the original attempt.
 *
 * Allowed delivery_status values for resend: failed | bounced | undeliverable
 * Allowed channels: email | sms (can't mechanically resend fb_message / call)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { sendDirect } from "@/lib/notifications/send-preferred";

export const dynamic = "force-dynamic";

const RESENDABLE_STATUSES = ["failed", "bounced", "undeliverable"];

export async function POST(
  req: NextRequest,
  { params }: { params: { attemptId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    // ── 1. Fetch original attempt + joined order ──
    const raw = await supabaseAdmin
      .from("seller_contact_attempts")
      .select(
        `id, order_id, attempt_number, channel, destination,
         message_template_key, message_body, delivery_status,
         orders ( seller_phone, seller_email, vehicle_year, vehicle_make, vehicle_model )`
      )
      .eq("id", params.attemptId)
      .maybeSingle();

    const attempt = raw.data as any;
    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    // ── 2. Validate ──
    const channel: string = attempt.channel;
    if (channel !== "email" && channel !== "sms") {
      return NextResponse.json(
        { error: `Cannot mechanically resend channel "${channel}". Only email and SMS are supported.` },
        { status: 400 }
      );
    }

    if (attempt.delivery_status && !RESENDABLE_STATUSES.includes(attempt.delivery_status)) {
      return NextResponse.json(
        { error: `Cannot resend attempt with delivery_status "${attempt.delivery_status}". Only failed, bounced, or undeliverable attempts can be resent.` },
        { status: 400 }
      );
    }

    const order = Array.isArray(attempt.orders) ? attempt.orders[0] : attempt.orders;
    const to: string | null =
      attempt.destination ||
      (channel === "sms" ? order?.seller_phone : order?.seller_email);

    if (!to) {
      return NextResponse.json({ error: "No destination contact info found on the attempt or order." }, { status: 400 });
    }

    // ── 3. Build message payload ──
    const messageBody: string = attempt.message_body ?? "";
    const payload = {
      subject: "Follow-up: Vehicle Inspection — RideCheck",
      html: `<div style="font-family: sans-serif; max-width: 600px; line-height: 1.6;">${messageBody.replace(/\n/g, "<br>")}</div>`,
      smsBody: messageBody,
    };

    // ── 4. Send with delivery tracking ──
    const statusCallback =
      channel === "sms" && process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`
        : undefined;

    const r = await sendDirect(channel as "email" | "sms", to, payload, { statusCallback });

    // ── 5. Determine next attempt_number for ops-initiated attempts ──
    const maxRaw = await supabaseAdmin
      .from("seller_contact_attempts")
      .select("attempt_number")
      .eq("order_id", attempt.order_id)
      .neq("channel", "buyer_message")
      .is("is_auto_notification", false)
      .order("attempt_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextNum = ((maxRaw.data as any)?.attempt_number ?? 0) + 1;

    // ── 6. Insert new attempt row ──
    const templateKey = attempt.message_template_key
      ? `${attempt.message_template_key}_resend`
      : "ops_diagnostics_resend";

    const insertRaw = await supabaseAdmin
      .from("seller_contact_attempts")
      .insert({
        order_id:             attempt.order_id,
        attempt_number:       nextNum,
        channel,
        destination:          to,
        message_template_key: templateKey,
        message_body:         messageBody,
        status:               r.success ? "sent" : "failed",
        delivery_status:      r.success ? "queued" : "failed",
        provider_message_id:  r.messageId ?? r.sid ?? null,
        is_auto_notification: false,
        created_by:           actor.userId,
      })
      .select("id, attempt_number")
      .single();

    const newAttempt = insertRaw.data as any;

    // ── 7. Increment order seller_contact_attempts counter ──
    const orderRaw = await supabaseAdmin
      .from("orders")
      .select("seller_contact_attempts")
      .eq("id", attempt.order_id)
      .single();

    const currentCount = (orderRaw.data as any)?.seller_contact_attempts ?? 0;
    await supabaseAdmin
      .from("orders")
      .update({ seller_contact_attempts: currentCount + 1 })
      .eq("id", attempt.order_id);

    // ── 8. Audit log ──
    await writeAuditLog({
      actorId:   actor.userId,
      actorEmail: actor.email,
      actorRole:  actor.role,
      action:     "order.seller_contact_resend",
      resourceId: attempt.order_id,
      newValue: {
        original_attempt_id: attempt.id,
        new_attempt_id:      newAttempt?.id,
        channel,
        destination:         to,
        success:             r.success,
        provider_message_id: r.messageId ?? r.sid ?? null,
      },
    });

    return NextResponse.json({
      success:             r.success,
      new_attempt_id:      newAttempt?.id,
      new_attempt_number:  newAttempt?.attempt_number,
      provider_message_id: r.messageId ?? r.sid ?? null,
      delivery_status:     r.success ? "queued" : "failed",
      error:               r.success ? undefined : String(r.error ?? "Send failed"),
    });
  } catch (err: any) {
    console.error("[delivery-diagnostics/resend] error", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}
