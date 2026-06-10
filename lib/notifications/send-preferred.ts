import { sendEmail } from "./email";
import { sendSMS } from "./sms";
import type { NotificationPreferences } from "@/types/orders";

export interface NotificationPayload {
  subject: string;
  html: string;
  smsBody: string;
}

export interface RecipientInfo {
  email?: string | null;
  phone?: string | null;
  notification_preferences?: NotificationPreferences | null;
}

type ChannelResult = {
  channel: "email" | "sms" | "none";
  success: boolean;
  /** Resend message ID (email only) */
  messageId?: string;
  /** Twilio SID (SMS only) */
  sid?: string;
  error?: any;
};

/**
 * Send a notification to a recipient via their preferred channel.
 * Falls back to SMS (if phone exists) then email (if email exists).
 * Always attempts both if preferences say "both".
 */
export async function sendPreferred(
  recipient: RecipientInfo,
  payload: NotificationPayload
): Promise<ChannelResult[]> {
  const prefs = recipient.notification_preferences;
  const results: ChannelResult[] = [];

  const emailOptIn = prefs?.email_opt_in !== false;
  const smsOptIn = prefs?.sms_opt_in !== false;
  const primary = prefs?.primary_method ?? null;

  const hasEmail = !!recipient.email;
  const hasPhone = !!recipient.phone;

  // Determine channels to use
  const useEmail = emailOptIn && hasEmail;
  const useSMS = smsOptIn && hasPhone;

  if (!useEmail && !useSMS) {
    return [{ channel: "none", success: false, error: "No valid contact method" }];
  }

  // Order by preference
  const channels: Array<"email" | "sms"> = [];
  if (primary === "email") {
    if (useEmail) channels.push("email");
    if (useSMS) channels.push("sms");
  } else if (primary === "sms" || primary === "phone") {
    if (useSMS) channels.push("sms");
    if (useEmail) channels.push("email");
  } else {
    // No preference — try SMS first (higher read rate), then email
    if (useSMS) channels.push("sms");
    if (useEmail) channels.push("email");
  }

  for (const channel of channels) {
    if (channel === "email" && recipient.email) {
      const r = await sendEmail({
        to: recipient.email,
        subject: payload.subject,
        html: payload.html,
      });
      results.push({ channel: "email", success: r.success, messageId: r.messageId, error: r.error });
    } else if (channel === "sms" && recipient.phone) {
      const r = await sendSMS({
        to: recipient.phone,
        body: payload.smsBody,
      });
      results.push({ channel: "sms", success: r.success, sid: r.sid, error: r.error });
    }
  }

  return results;
}

/**
 * Send via a single explicit channel, ignoring preferences.
 * Used for seller messages where contact info comes from order fields.
 */
export async function sendDirect(
  channel: "email" | "sms",
  to: string,
  payload: NotificationPayload,
  options?: { statusCallback?: string }
): Promise<ChannelResult> {
  if (channel === "email") {
    const r = await sendEmail({ to, subject: payload.subject, html: payload.html });
    return { channel: "email", success: r.success, messageId: r.messageId, error: r.error };
  } else {
    const r = await sendSMS({ to, body: payload.smsBody, statusCallback: options?.statusCallback });
    return { channel: "sms", success: r.success, sid: r.sid, error: r.error };
  }
}
