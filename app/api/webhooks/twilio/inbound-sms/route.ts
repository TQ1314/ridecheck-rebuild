/**
 * POST /api/webhooks/twilio/inbound-sms
 *
 * Handles inbound SMS messages forwarded by Twilio when a seller replies.
 *
 * Configure in Twilio Console:
 *   Phone Number → Messaging → "A message comes in" → Webhook
 *   URL: https://<your-domain>/api/webhooks/twilio/inbound-sms
 *   Method: HTTP POST
 *
 * Twilio POST fields: From, To, Body, MessageSid, NumMedia, ...
 *
 * Flow:
 *   1. Verify Twilio signature
 *   2. Match sender phone to an order (replyMatcher)
 *   3. Extract scheduling data (dataExtractor)
 *   4. Insert into seller_messages
 *   5. Update order.seller_replied_at if first reply
 *   6. Write order_events timeline entry
 *   7. Notify ops team
 *   8. Reply with TwiML 200 OK (empty — no auto-reply)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { matchReplyToOrder } from "@/lib/seller-contact/replyMatcher";
import { extractFromText, hasExtractedData } from "@/lib/seller-contact/dataExtractor";
import { notifyOpsTeam } from "@/lib/notifications/notifyOps";
import { writeOrderEvent } from "@/lib/rbac";

export const dynamic = "force-dynamic";

async function verifyTwilioSignature(
  req: NextRequest,
  rawBody: string,
  authToken: string
): Promise<boolean> {
  try {
    const twilio = require("twilio");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) return false;
    const url       = `${appUrl}/api/webhooks/twilio/inbound-sms`;
    const signature = req.headers.get("x-twilio-signature") ?? "";
    const params: Record<string, string> = {};
    new URLSearchParams(rawBody).forEach((v, k) => { params[k] = v; });
    return twilio.validateRequest(authToken, signature, url, params);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
      const valid = await verifyTwilioSignature(req, rawBody, authToken);
      if (!valid && process.env.NODE_ENV === "production") {
        console.warn("[inbound-sms] Invalid Twilio signature — rejecting");
        return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
          status: 403,
          headers: { "Content-Type": "text/xml" },
        });
      }
      if (!valid) {
        console.warn("[inbound-sms] Invalid Twilio signature (dev — allowing)");
      }
    }

    const params     = new URLSearchParams(rawBody);
    const from       = params.get("From") ?? "";
    const to         = params.get("To") ?? "";
    const body       = params.get("Body") ?? "";
    const messageSid = params.get("MessageSid") ?? "";

    if (!from || !body) {
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    console.log(`[inbound-sms] From=${from} SID=${messageSid} Body=${body.slice(0, 80)}`);

    // ── Match to order ──
    const match = await matchReplyToOrder({ channel: "sms", fromAddress: from, toAddress: to });

    const rawPayload = Object.fromEntries(params.entries());
    const extracted  = extractFromText(body);

    // ── Insert seller_messages row ──
    const { data: msgRow } = await supabaseAdmin
      .from("seller_messages")
      .insert({
        order_id:            match?.orderId ?? null,
        channel:             "sms",
        direction:           "inbound",
        from_address:        from,
        to_address:          to,
        body,
        raw_payload:         rawPayload,
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
      console.warn(`[inbound-sms] No order match for ${from} — stored as unmatched (id=${(msgRow as any)?.id})`);
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const { orderId, orderNumber } = match;

    // ── Update order: seller_replied_at (only if not already set) ──
    const { data: existingOrder } = await supabaseAdmin
      .from("orders")
      .select("seller_replied_at, order_number")
      .eq("id", orderId)
      .single();

    const now = new Date().toISOString();
    const orderUpdate: Record<string, any> = { updated_at: now };
    const isFirstReply = !(existingOrder as any)?.seller_replied_at;
    if (isFirstReply) orderUpdate.seller_replied_at = now;

    // Auto-populate extracted availability if not already set
    if (extracted.dates.length > 0) {
      const { data: curr } = await supabaseAdmin.from("orders").select("seller_available_date").eq("id", orderId).single();
      if (!(curr as any)?.seller_available_date) {
        orderUpdate.seller_available_date = extracted.dates[0];
      }
    }
    if (extracted.times.length > 0) {
      const { data: curr } = await supabaseAdmin.from("orders").select("seller_available_time").eq("id", orderId).single();
      if (!(curr as any)?.seller_available_time) {
        orderUpdate.seller_available_time = extracted.times[0];
      }
    }
    if (extracted.addresses.length > 0) {
      const { data: curr } = await supabaseAdmin.from("orders").select("seller_inspection_address").eq("id", orderId).single();
      if (!(curr as any)?.seller_inspection_address) {
        orderUpdate.seller_inspection_address = extracted.addresses[0];
      }
    }

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
        channel:     "sms",
        from,
        message_sid: messageSid,
        body_preview: body.slice(0, 120),
        extracted,
        match_method: match.method,
        message_id:  (msgRow as any)?.id,
      },
    });

    // ── Notify ops team ──
    const displayOrder = orderNumber || orderId.slice(0, 8);
    await notifyOpsTeam({
      subject:  `Seller responded — ${displayOrder}`,
      body:     `Seller replied via SMS to order ${displayOrder}.\n\nMessage: "${body.slice(0, 200)}"\n\nExtracted: dates=${extracted.dates.join(", ")||"none"} times=${extracted.times.join(", ")||"none"} addresses=${extracted.addresses.join(", ")||"none"}`,
      smsBody:  `RideCheck: Seller responded to ${displayOrder} via SMS. "${body.slice(0, 100)}"`,
      orderId,
    });

    console.log(`[inbound-sms] Matched order=${orderId} event=${eventType}`);

    // Return empty TwiML (no auto-reply to seller)
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err: any) {
    console.error("[inbound-sms] Unexpected error:", err);
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
      status: 500,
      headers: { "Content-Type": "text/xml" },
    });
  }
}
