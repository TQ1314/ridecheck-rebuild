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
}

export async function notifyOpsTeam(payload: OpsNotificationPayload): Promise<void> {
  try {
    // Find active ops staff
    const { data: opsUsers } = await supabaseAdmin
      .from("profiles")
      .select("id, email, phone, role")
      .in("role", ["operations", "operations_lead", "ops_lead", "owner"])
      .eq("is_active", true);

    if (!opsUsers || opsUsers.length === 0) return;

    const tasks: Promise<any>[] = [];

    for (const user of opsUsers as any[]) {
      if (user.phone) {
        tasks.push(
          sendSMS({ to: user.phone, body: payload.smsBody }).catch((e) =>
            console.error(`[notifyOps] SMS to ${user.phone} failed:`, e)
          )
        );
      } else if (user.email) {
        const html = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <p style="font-size:16px;color:#111;">${payload.body.replace(/\n/g, "<br>")}</p>
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
          sendEmail({ to: user.email, subject: payload.subject, html }).catch((e) =>
            console.error(`[notifyOps] Email to ${user.email} failed:`, e)
          )
        );
      }
    }

    await Promise.allSettled(tasks);
  } catch (err) {
    console.error("[notifyOps] Unexpected error:", err);
  }
}
