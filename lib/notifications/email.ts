import { Resend } from "resend";
import { captureStagingNotification, stagingCaptureEnabled } from "./staging-capture";

const apiKey = process.env.RESEND_API_KEY;
const _rawFrom = process.env.RESEND_FROM_EMAIL || "support@ridecheckauto.com";

function buildSender(displayName: string, raw: string): string {
  return raw.includes("<") ? raw : `${displayName} <${raw}>`;
}

const fromDisplay = buildSender("RideCheck", _rawFrom);

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
  event,
  template,
  orderId,
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  event?: string;
  template?: string;
  orderId?: string;
}): Promise<{ success: boolean; dev?: boolean; messageId?: string; data?: any; error?: any }> {
  // Only enrich the existing paid confirmation template. Other messages and
  // non-Facebook/historical Concierge content are passed through unchanged.
  if (template === "buyer-paid-confirmation" && orderId) {
    try {
      const { supabaseAdmin } = await import("@/lib/supabase/admin");
      const { data: order, error } = await supabaseAdmin.from("orders")
        .select("booking_type, listing_url, platform_source, preferred_date")
        .eq("id", orderId).maybeSingle();
      if (error || !order) throw new Error("Paid confirmation order details unavailable");
      const { isFacebookSelfArrange } = await import("@/lib/seller-contact/facebook-self-arrange");
      if (isFacebookSelfArrange(order)) {
        const { facebookSelfArrangePaidConfirmationHtml } = await import("@/lib/email/templates/order-confirmation");
        html = facebookSelfArrangePaidConfirmationHtml(html, order.preferred_date, order.listing_url);
      }
    } catch (error) {
      console.error("[Paid confirmation context]", error);
      return { success: false, error };
    }
  }

  if (stagingCaptureEnabled()) {
    await captureStagingNotification({
      recipient: to,
      channel: "email",
      event: event ?? "email.send",
      template: template ?? event ?? "email.send",
      orderId,
      content: html,
      payload: { from: fromDisplay, to, subject, html, replyTo },
    });
    return { success: true, dev: true };
  }

  if (!resend) {
    console.log(`[EMAIL-TEST] to=${to} subject=${subject} reply_to=${replyTo ?? "n/a"}`);
    return { success: true, dev: true };
  }

  try {
    const sendParams: any = { from: fromDisplay, to, subject, html };
    if (replyTo) sendParams.reply_to = replyTo;
    const { data, error } = await resend.emails.send(sendParams);
    if (error) {
      console.error("[Resend Error]", error);
      return { success: false, error };
    }
    return { success: true, messageId: data?.id ?? undefined, data };
  } catch (err) {
    console.error("[Resend Error]", err);
    return { success: false, error: err };
  }
}
