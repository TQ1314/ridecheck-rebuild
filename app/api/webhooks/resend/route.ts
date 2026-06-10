/**
 * Resend delivery webhook — receives email lifecycle events via Svix.
 *
 * Configure in the Resend dashboard:
 *   Endpoint URL: https://<your-domain>/api/webhooks/resend
 *   Events: email.delivered, email.bounced, email.complained, email.delivery_delayed
 *
 * Set RESEND_WEBHOOK_SECRET in environment variables (from Resend → Webhooks → Signing Secret).
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const RESEND_DELIVERY_STATUS: Record<string, string> = {
  "email.delivered":        "delivered",
  "email.bounced":          "bounced",
  "email.complained":       "bounced",
  "email.delivery_delayed": "queued",
  "email.sent":             "sent",
};

/** Svix signature verification — https://docs.svix.com/receiving/verifying-payloads/how */
function verifyResendSignature(rawBody: string, headers: Headers, secret: string): boolean {
  const msgId        = headers.get("svix-id");
  const msgTimestamp = headers.get("svix-timestamp");
  const msgSignature = headers.get("svix-signature");

  if (!msgId || !msgTimestamp || !msgSignature) return false;

  // Reject stale payloads (> 5 minutes old)
  const ts = parseInt(msgTimestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  // Decode secret (Resend prefixes it with "whsec_")
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${msgId}.${msgTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  // svix-signature may contain multiple space-separated "v1,<base64>" tokens
  return msgSignature.split(" ").some((token) => {
    const [, sig] = token.split(",");
    if (!sig) return false;
    try {
      const expectedBuf = Buffer.from(expected);
      const actualBuf   = Buffer.from(sig);
      if (expectedBuf.length !== actualBuf.length) return false;
      return timingSafeEqual(expectedBuf, actualBuf);
    } catch {
      return false;
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify signature when secret is configured
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (secret) {
      if (!verifyResendSignature(rawBody, req.headers, secret)) {
        console.warn("[resend-webhook] Invalid signature");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      // No secret configured — only accept in non-production
      if (process.env.NODE_ENV === "production") {
        console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not set in production");
        return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
      }
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.type ?? "";
    const emailId: string | undefined = event.data?.email_id ?? event.data?.id;

    if (!emailId) {
      // Nothing to match — acknowledge and ignore
      return NextResponse.json({ received: true });
    }

    const deliveryStatus = RESEND_DELIVERY_STATUS[eventType];
    if (!deliveryStatus) {
      // Unrecognised event type — acknowledge without error
      return NextResponse.json({ received: true, ignored: true });
    }

    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("seller_contact_attempts")
      .update({
        delivery_status:     deliveryStatus,
        delivery_updated_at: now,
      })
      .eq("provider_message_id", emailId);

    if (error) {
      console.error("[resend-webhook] DB update error", error);
      // Return 200 so Resend doesn't retry endlessly
    } else {
      console.log(`[resend-webhook] ${eventType} → ${deliveryStatus} for email_id=${emailId}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[resend-webhook] Unexpected error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
