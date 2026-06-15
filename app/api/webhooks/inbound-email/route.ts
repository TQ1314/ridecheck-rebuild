/**
 * POST /api/webhooks/inbound-email
 *
 * Generic inbound email webhook — receives seller, buyer, and RideChecker replies.
 * Compatible with Postmark Inbound Parse (primary) and JSON / multipart providers.
 *
 * ── Postmark setup ─────────────────────────────────────────────────────────────
 * 1. Add domain (e.g. replies.ridecheckauto.com) in Postmark → Inbound → Domain
 * 2. Point inbound MX record: replies.ridecheckauto.com → inbound.postmarkapp.com (priority 10)
 * 3. Set Inbound Webhook URL: https://<your-domain>/api/webhooks/inbound-email
 * 4. Optionally set INBOUND_EMAIL_WEBHOOK_SECRET + X-Postmark-Inbound-Secret header
 *
 * ── Matching strategies (in priority order) ────────────────────────────────────
 *  1. reply_to_tag    — replies+RC-XXXX@domain parsed from To address
 *  2. subject_order_ref — RC-XXXX in subject line
 *  3. email_lookup    — from_address matches orders.seller_email
 *  4. (future) conversation_id — Message-ID / In-Reply-To threading
 *
 * ── Party detection ─────────────────────────────────────────────────────────────
 * After matching to an order, detectInboundParty() checks whether the sender is
 * a seller, buyer, or RideChecker and sets sender_type on the seller_messages row.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { matchReplyToOrder } from "@/lib/seller-contact/replyMatcher";
import { detectInboundParty } from "@/lib/seller-contact/partyDetector";
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
  const m = (field ?? "").match(/<([^>]+)>/);
  return (m ? m[1] : field).trim().toLowerCase();
}

/** Normalize payloads from Postmark (JSON, capitalized keys) or other providers */
async function normalizePayload(req: NextRequest): Promise<NormalizedEmail | null> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await req.json();

    // Postmark uses capitalized keys: From, To, Subject, TextBody
    // Generic providers use lowercase: from, to, subject, text/plain/body
    return {
      from:    extractEmailAddress(body.From    ?? body.from    ?? body.sender   ?? ""),
      to:      extractEmailAddress(body.To      ?? body.to      ?? body.recipient ?? ""),
      subject: body.Subject  ?? body.subject  ?? "",
      text:    body.TextBody ?? body.text     ?? body.plain    ?? body.body ?? "",
    };
  }

  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const fd = await req.formData();
    const get = (k: string) => fd.get(k)?.toString() ?? "";
    return {
      from:    extractEmailAddress(get("From")  || get("from")  || get("sender")),
      to:      extractEmailAddress(get("To")    || get("to")    || get("recipient")),
      subject: get("Subject") || get("subject"),
      text:    get("TextBody") || get("text") || get("plain") || get("body"),
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    // Optional shared-secret validation
    const webhookSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
    if (webhookSecret && process.env.NODE_ENV === "production") {
      const provided =
        req.headers.get("x-webhook-secret") ??
        req.headers.get("x-ridecheck-secret") ??
        req.headers.get("x-postmark-inbound-secret");
      if (provided !== webhookSecret) {
        console.warn("[inbound-email] Invalid webhook secret");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const email = await normalizePayload(req);
    if (!email || !email.from || !email.text) {
      return NextResponse.json({ ok: true, ignored: true, reason: "empty_payload" });
    }

    // Skip bounces, auto-replies, and delivery notifications
    const lowerSubject = email.subject.toLowerCase();
    if (
      lowerSubject.includes("undeliverable") ||
      lowerSubject.includes("auto-reply") ||
      lowerSubject.includes("out of office") ||
      lowerSubject.startsWith("delivery status notification") ||
      lowerSubject.startsWith("mailer-daemon") ||
      lowerSubject.startsWith("postmaster")
    ) {
      return NextResponse.json({ ok: true, ignored: true, reason: "auto_reply_or_bounce" });
    }

    console.log(`[inbound-email] From=${email.from} To=${email.to} Subject=${email.subject?.slice(0, 80)}`);

    // ── Match to order ──────────────────────────────────────────────────
    const match = await matchReplyToOrder({
      channel:     "email",
      fromAddress: email.from,
      toAddress:   email.to,
      subject:     email.subject,
    });

    const extracted = extractFromText(email.text);

    // ── Detect sender party (only meaningful when matched) ──────────────
    let senderParty: "seller" | "buyer" | "ridechecker" | "unknown" = "unknown";
    if (match?.orderId) {
      senderParty = await detectInboundParty({
        fromAddress: email.from,
        orderId:     match.orderId,
      });
    }
    // Un-matched inbound with no type → treat as seller for backward compat
    const resolvedParty = senderParty === "unknown" ? "seller" : senderParty;

    // ── Insert seller_messages row ──────────────────────────────────────
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
        sender_type:         resolvedParty,
        recipient_type:      "ops",
        status:              "received",
      })
      .select("id")
      .single();

    if (!match?.orderId) {
      console.warn(`[inbound-email] No order match for ${email.from} — stored unmatched (id=${(msgRow as any)?.id} party=${resolvedParty})`);
      return NextResponse.json({ ok: true, matched: false, party: resolvedParty });
    }

    const { orderId, orderNumber } = match;

    // ── Update order fields ──────────────────────────────────────────────
    const now = new Date().toISOString();
    const orderUpdate: Record<string, any> = { updated_at: now };

    const { data: existingOrder } = await supabaseAdmin
      .from("orders")
      .select("seller_replied_at, seller_available_date, seller_available_time, seller_inspection_address")
      .eq("id", orderId)
      .single();

    const o = existingOrder as any;

    // Only update seller-specific fields for seller replies
    if (resolvedParty === "seller") {
      if (!o?.seller_replied_at)          orderUpdate.seller_replied_at        = now;
      if (!o?.seller_available_date   && extracted.dates.length > 0)     orderUpdate.seller_available_date     = extracted.dates[0];
      if (!o?.seller_available_time   && extracted.times.length > 0)     orderUpdate.seller_available_time     = extracted.times[0];
      if (!o?.seller_inspection_address && extracted.addresses.length > 0) orderUpdate.seller_inspection_address = extracted.addresses[0];
    }

    await supabaseAdmin.from("orders").update(orderUpdate).eq("id", orderId);

    // ── Timeline event ───────────────────────────────────────────────────
    const partyEventPrefix = resolvedParty === "buyer" ? "buyer" : resolvedParty === "ridechecker" ? "ridechecker" : "seller";
    let eventType: string;
    if (resolvedParty === "seller" && hasExtractedData(extracted)) {
      eventType = extracted.addresses.length > 0
        ? "seller_inspection_address_provided"
        : "seller_availability_provided";
    } else {
      eventType = `${partyEventPrefix}_reply_received`;
    }

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
        sender_type:  resolvedParty,
        message_id:   (msgRow as any)?.id,
      },
    });

    // ── Notify ops team ──────────────────────────────────────────────────
    const displayOrder = orderNumber || orderId.slice(0, 8);
    const partyLabel = resolvedParty === "buyer" ? "Buyer" : resolvedParty === "ridechecker" ? "RideChecker" : "Seller";
    await notifyOpsTeam({
      subject: `${partyLabel} replied — ${displayOrder}`,
      body:    `${partyLabel} replied via email to order ${displayOrder}.\n\nSubject: "${email.subject}"\nMessage: "${email.text.slice(0, 200)}"\n\nExtracted: dates=${extracted.dates.join(", ")||"none"} times=${extracted.times.join(", ")||"none"} addresses=${extracted.addresses.join(", ")||"none"}`,
      smsBody: `RideCheck: ${partyLabel} replied to ${displayOrder} via email. "${email.text.slice(0, 100)}"`,
      orderId,
    });

    console.log(`[inbound-email] Matched order=${orderId} party=${resolvedParty} event=${eventType}`);

    return NextResponse.json({ ok: true, matched: true, orderId, party: resolvedParty, event: eventType });
  } catch (err: any) {
    console.error("[inbound-email] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
