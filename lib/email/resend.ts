import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@ridecheck.com";

export const resend = apiKey ? new Resend(apiKey) : null;

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}`);
    return { success: true, dev: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
    });
    if (error) {
      console.error("[Resend Error]", error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error("[Resend Error]", err);
    return { success: false, error: err };
  }
}
