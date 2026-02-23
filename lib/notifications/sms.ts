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
}: {
  to: string;
  body: string;
}): Promise<{ success: boolean; dev?: boolean; sid?: string; error?: any }> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!client || !from) {
    const safeBody = process.env.NODE_ENV === "production" ? "[REDACTED]" : body;
    console.log(`[SMS-TEST] to=${to} body=${safeBody}`);
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
