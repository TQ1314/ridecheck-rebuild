import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const _rawFrom = process.env.RESEND_FROM_EMAIL || "support@ridecheckauto.com";

function buildSender(displayName: string, raw: string): string {
  return raw.includes("<") ? raw : `${displayName} <${raw}>`;
}

const fromDisplay = buildSender("RideCheck", _rawFrom);

export const resend = apiKey ? new Resend(apiKey) : null;

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ success: boolean; dev?: boolean; messageId?: string; data?: any; error?: any }> {
  if (!resend) {
    const safeBody = process.env.NODE_ENV === "production" ? "[REDACTED]" : html;
    console.log(`[EMAIL-TEST] to=${to} subject=${subject} reply_to=${replyTo ?? "n/a"} body=${safeBody}`);
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
