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
}: {
  to: string;
  body: string;
}) {
  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!client || !from) {
    console.log(`[DEV SMS] To: ${to} | Body: ${body}`);
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
