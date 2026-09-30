import { captureStagingNotification, stagingCaptureEnabled } from "./staging-capture";

let twilioClient: any = null;

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  if (!twilioClient) {
    const twilio = require("twilio");
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

export async function sendSMS({
  to,
  body,
  statusCallback,
  event,
  template,
  orderId,
}: {
  to: string;
  body: string;
  /** Optional HTTPS URL for Twilio to POST delivery status updates */
  statusCallback?: string;
  event?: string;
  template?: string;
  orderId?: string;
}): Promise<{ success: boolean; dev?: boolean; sid?: string; error?: any }> {
  if (stagingCaptureEnabled()) {
    await captureStagingNotification({
      recipient: to,
      channel: "sms",
      event: event ?? "sms.send",
      template: template ?? event ?? "sms.send",
      orderId,
      content: body,
      payload: { to, body, statusCallback },
    });
    return { success: true, dev: true };
  }

  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!client || !from) {
    console.log(`[SMS-TEST] to=${to}`);
    return { success: true, dev: true };
  }

  try {
    const createParams: Record<string, string> = { body, from, to };
    if (statusCallback) createParams.statusCallback = statusCallback;
    const message = await client.messages.create(createParams);
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error("[Twilio Error]", err);
    return { success: false, error: err };
  }
}
