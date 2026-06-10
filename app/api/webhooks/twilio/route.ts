/**
 * Twilio delivery status webhook.
 *
 * Twilio POSTs form-encoded status updates to this endpoint when an SMS status changes.
 * The StatusCallback URL is set at send time via the sendSMS statusCallback param:
 *   https://<your-domain>/api/webhooks/twilio
 *
 * No extra environment variables needed — uses existing TWILIO_AUTH_TOKEN.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Map Twilio MessageStatus values to our delivery_status enum */
const TWILIO_DELIVERY_STATUS: Record<string, string> = {
  queued:       "queued",
  sending:      "queued",
  sent:         "sent",
  delivered:    "delivered",
  undelivered:  "undeliverable",
  failed:       "failed",
};

/**
 * Validate a Twilio request signature.
 * Twilio computes HMAC-SHA1 of the URL + sorted POST params using the auth token.
 */
async function verifyTwilioSignature(
  req: NextRequest,
  rawBody: string,
  authToken: string
): Promise<boolean> {
  try {
    const twilio = require("twilio");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) return false;

    const url = `${appUrl}/api/webhooks/twilio`;
    const signature = req.headers.get("x-twilio-signature") ?? "";

    // Parse form body into params object
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
      if (!valid) {
        // In dev/staging the signature often fails due to tunnel URLs — log but allow
        if (process.env.NODE_ENV === "production") {
          console.warn("[twilio-webhook] Invalid signature — rejecting");
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.warn("[twilio-webhook] Invalid signature (dev mode — allowing)");
      }
    }

    const params = new URLSearchParams(rawBody);
    const messageSid    = params.get("MessageSid");
    const messageStatus = params.get("MessageStatus") ?? "";

    if (!messageSid) {
      return NextResponse.json({ received: true });
    }

    const deliveryStatus = TWILIO_DELIVERY_STATUS[messageStatus];
    if (!deliveryStatus) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("seller_contact_attempts")
      .update({
        delivery_status:     deliveryStatus,
        delivery_updated_at: now,
      })
      .eq("provider_message_id", messageSid);

    if (error) {
      console.error("[twilio-webhook] DB update error", error);
    } else {
      console.log(`[twilio-webhook] ${messageStatus} → ${deliveryStatus} for SID=${messageSid}`);
    }

    // Twilio expects a 204 or 200 with no TwiML required for status callbacks
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[twilio-webhook] Unexpected error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
