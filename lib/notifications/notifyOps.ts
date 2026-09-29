/**
 * lib/notifications/notifyOps.ts
 *
 * Send an internal notification to all active ops / operations_lead / owner users.
 * Used when seller replies come in, assignment events happen, etc.
 * Sends SMS to those with phone numbers (highest read rate), email as fallback.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "./email";
import { sendSMS } from "./sms";

export interface OpsNotificationPayload {
  subject:  string;
  body:     string;
  smsBody:  string;
  orderId?: string;
  emailAll?: boolean;
}

export async function notifyOpsTeam(payload: OpsNotificationPayload): Promise<void> {
  try {
    // Find active ops staff
    const { data: opsUsers } = await supabaseAdmin
      .from("profiles")
      .select("id, email, phone, role")
      .in("role", ["operations", "operations_lead", "ops_lead", "owner"])
      .eq("is_active", true);

    if ((!opsUsers || opsUsers.length === 0) && !process.env.ADMIN_EMAIL) {
      console.error("[notifyOps] No recipients configured", { orderId: payload.orderId });
      return;
    }

    const tasks: Promise<any>[] = [];

    const emailRecipients = new Set<string>();
    for (const user of (opsUsers ?? []) as any[]) {
      if (user.phone) {
        tasks.push(
          sendSMS({ to: user.phone, body: payload.smsBody }).then((result) => {
            if (!result.success) console.error("[notifyOps] SMS provider rejected notification", { orderId: payload.orderId });
          }).catch((e) => console.error("[notifyOps] SMS failed", { orderId: payload.orderId, error: e }))
        );
      }
      if (user.email && (payload.emailAll || !user.phone)) emailRecipients.add(user.email);
    }
    if (payload.emailAll && process.env.ADMIN_EMAIL) emailRecipients.add(process.env.ADMIN_EMAIL);
    for (const recipient of emailRecipients) {
        const escape = (text: string) => text.replace(/[&<>"']/g, (char) =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
        const html = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <p style="font-size:16px;color:#111;">${escape(payload.body).replace(/\n/g, "<br>")}</p>
            ${
              payload.orderId
                ? `<p><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/orders/${payload.orderId}" style="color:#22774F;">View Order →</a></p>`
                : ""
            }
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
            <p style="font-size:12px;color:#888;">RideCheck Operations · support@ridecheckauto.com</p>
          </div>
        `;
        tasks.push(
          sendEmail({ to: recipient, subject: payload.subject, html }).then((result) => {
            if (!result.success) console.error("[notifyOps] Email provider rejected notification", { orderId: payload.orderId });
          }).catch((e) => console.error("[notifyOps] Email failed", { orderId: payload.orderId, error: e }))
        );
    }

    await Promise.allSettled(tasks);
  } catch (err) {
    console.error("[notifyOps] Unexpected error:", err);
  }
}
