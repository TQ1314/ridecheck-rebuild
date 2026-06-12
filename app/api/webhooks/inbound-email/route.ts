/**
 * POST /api/webhooks/inbound-email
 *
 * Generic inbound email webhook endpoint.
 * Compatible with Resend Email Routing (inbound) and other inbound parse services.
 *
 * Setup options:
 *  A) Resend Email Routing:
 *     - Add a domain in Resend → Email Routing → Route replies+* to this webhook
 *     - URL: https://<your-domain>/api/webhooks/inbound-email
 *
 *  B) Postmark / SendGrid Inbound Parse:
 *     - Configure MX record for replies.ridecheckauto.com → Postmark/SendGrid
 *     - Point webhook URL to this endpoint
 *
 * Expected JSON body (normalized):
 *   { from, to, subject, text, html, headers }
 * or multipart/form-data (SendGrid-style):
 *   { from, to, subject, text, ... }
 *
 * All formats are normalized into the same internal structure.
 *
 * Security: Validate shared secret header or IP allowlist in production.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { matchReplyToOrder } from "@/lib/seller-contact/replyMatcher";
import { extractFromText, hasExtractedData } from "@/lib/seller-contact/dataExtractor";
import { notifyOpsTeam } from "@/lib/notifications/notifyOps";
import { writeOrderEvent } from "@/lib/rbac";

export const dynamic = "force-dynamic";

interface NormalizedEmail {
  from:    string;
  to:      string;
  subject: string;
  text:    string;
}

function extractEmailAddress(field: string): string {
  // Handle "Name <email@example.com>" format
  const m = field.match(/<([^>]+)>/);
  return (m ? m[1] : field).trim().toLowerCase();
}

async function normalizePayload(req: NextRequest): Promise<NormalizedEmail | null> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await req.json();
    return {
      from:    extractEmailAddress(body.from ?? body.sender ?? ""),
      to:      extractEmailAddress(body.to ?? body.recipient ?? ""),
      subject: body.subject ?? "",
      text:    body.text ?? body.plain ?? body.body ?? "",
    };
  }

  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const fd = await req.formData();
    const get = (k: string) => fd.get(k)?.toString() ?? "";
    return {
      from:    extractEmailAddress(get("from") || get("sender")),
      to:      extractEmailAddress(get("to") || get("recipient")),
      subject: get("subject"),
      text:    get("text") || get("plain") || get("body"),
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    // Optional shared-secret validation
    const webhookSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
    if (webhookSecret && process.env.NODE_ENV === "production") {
      const provided = req.headers.get("x-webhook-secret") ?? req.headers.get("x-ridecheck-secret");
      if (provided !== webhookSecret) {
        console.warn("[inbound-email] Invalid webhook secret");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const email = await normalizePayload(req);
    if (!email || !email.from || !email.text) {
      return NextResponse.json({ ok: true, ignored: true, reason: "empty_payload" });
    }

    // Skip bounces and auto-replies
    const lowerSubject = email.subject.toLowerCase();
    if (
      lowerSubject.includes("undeliverable") ||
      lowerSubject.includes("auto-reply") ||
      lowerSubject.includes("out of office") ||
      lowerSubject.startsWith("delivery status notification") ||
      lowerSubject.startsWith("mailer-daemon")
    ) {
      return NextResponse.json({ ok: true, ignored: true, reason: "auto_reply_or_bounce" });
    }

    console.log(`[inbound-email] From=${email.from} Subject=${email.subject?.slice(0, 80)}`);

    // ── Match to order ──
    const match = await matchReplyToOrder({
      channel:     "email",
      fromAddress: email.from,
      toAddress:   email.to,
      subject:     email.subject,
    });

    const extracted = extractFromText(email.text);

    // ── Insert seller_messages row ──
    const { data: msgRow } = await supabaseAdmin
      .from("seller_messages")
      .insert({
        order_id:            match?.orderId ?? null,
        channel:             "email",
        direction:           "inbound",
        from_address:        email.from,
        to_address:          email.to,
        subject:             email.subject,
        body:                email.text,
        match_method:        match?.method ?? null,
        extracted_dates:     extracted.dates,
        extracted_times:     extracted.times,
        extracted_addresses: extracted.addresses,
        extracted_phones:    extracted.phones,
        is_read:             false,
      })
      .select("id")
      .single();

    if (!match?.orderId) {
      console.warn(`[inbound-email] No order match for ${email.from} — stored as unmatched (id=${(msgRow as any)?.id})`);
      return NextResponse.json({ ok: true, matched: false });
    }

    const { orderId, orderNumber } = match;

    // ── Update order fields ──
    const now = new Date().toISOString();
    const orderUpdate: Record<string, any> = { updated_at: now };

    const { data: existingOrder } = await supabaseAdmin
      .from("orders")
      .select("seller_replied_at, seller_available_date, seller_available_time, seller_inspection_address")
      .eq("id", orderId)
      .single();

    const o = existingOrder as any;
    if (!o?.seller_replied_at)         orderUpdate.seller_replied_at = now;
    if (!o?.seller_available_date   && extracted.dates.length > 0)     orderUpdate.seller_available_date     = extracted.dates[0];
    if (!o?.seller_available_time   && extracted.times.length > 0)     orderUpdate.seller_available_time     = extracted.times[0];
    if (!o?.seller_inspection_address && extracted.addresses.length > 0) orderUpdate.seller_inspection_address = extracted.addresses[0];

    await supabaseAdmin.from("orders").update(orderUpdate).eq("id", orderId);

    // ── Timeline event ──
    const eventType = hasExtractedData(extracted)
      ? extracted.addresses.length > 0
        ? "seller_inspection_address_provided"
        : "seller_availability_provided"
      : "seller_reply_received";

    await writeOrderEvent({
      orderId,
      eventType,
      actorId:    "00000000-0000-0000-0000-000000000000",
      actorEmail: "system",
      details: {
        channel:      "email",
        from:         email.from,
        subject:      email.subject,
        body_preview: email.text.slice(0, 120),
        extracted,
        match_method: match.method,
        message_id:  (msgRow as any)?.id,
      },
    });

    // ── Notify ops team ──
    const displayOrder = orderNumber || orderId.slice(0, 8);
    await notifyOpsTeam({
      subject:  `Seller responded — ${displayOrder}`,
      body:     `Seller replied via email to order ${displayOrder}.\n\nSubject: "${email.subject}"\nMessage: "${email.text.slice(0, 200)}"\n\nExtracted: dates=${extracted.dates.join(", ")||"none"} times=${extracted.times.join(", ")||"none"} addresses=${extracted.addresses.join(", ")||"none"}`,
      smsBody:  `RideCheck: Seller responded to ${displayOrder} via email. "${email.text.slice(0, 100)}"`,
      orderId,
    });

    console.log(`[inbound-email] Matched order=${orderId} event=${eventType}`);

    return NextResponse.json({ ok: true, matched: true, orderId, event: eventType });
  } catch (err: any) {
    console.error("[inbound-email] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
