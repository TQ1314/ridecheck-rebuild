import { captureStagingNotification, stagingCaptureEnabled } from "@/lib/notifications/staging-capture";

let twilioClient: any = null;

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.log("[DEV MODE] Twilio credentials not set — SMS disabled");
    return null;
  }
  if (!twilioClient) {
    const twilio = require("twilio");
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

export async function sendSMS({
  to,
  body,
  event,
  template,
  orderId,
}: {
  to: string;
  body: string;
  event?: string;
  template?: string;
  orderId?: string;
}) {
  if (stagingCaptureEnabled()) {
    await captureStagingNotification({
      recipient: to,
      channel: "sms",
      event: event ?? "sms.send",
      template: template ?? event ?? "sms.send",
      orderId,
      content: body,
      payload: { to, body },
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
    const message = await client.messages.create({ body, from, to });
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error("[Twilio Error]", err);
    return { success: false, error: err };
  }
}
