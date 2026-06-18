import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { sendSMS } from "@/lib/notifications/sms";
import {
  pickTemplate,
  REMINDER_TEMPLATES,
  DEDUP_DAYS,
  DASHBOARD_URL,
  type ReminderTemplateKey,
} from "@/lib/ridecheckers/reminderTemplates";
import type { EligibilityProfile } from "@/lib/ridecheckers/eligibility";

const OPS_ROLES = ["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"];

export async function POST(req: NextRequest) {
  const authResult = await requireRole(OPS_ROLES);
  if (!isAuthorized(authResult)) return authResult.error;
  const { actor } = authResult;

  const body = await req.json();
  const { template_key, channels } = body as {
    template_key: ReminderTemplateKey;
    channels?: string[];
  };

  if (!template_key || !REMINDER_TEMPLATES[template_key]) {
    return NextResponse.json({ error: "Invalid template_key" }, { status: 400 });
  }

  const useChannels = channels ?? ["email"];
  const template = REMINDER_TEMPLATES[template_key];

  // Fetch all active RideCheckers
  const { data: profiles, error: fetchErr } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, full_name, email, phone, service_area, rc_city, rc_state, rc_zip, " +
      "workflow_stage, is_active, verification_status, background_check_status, " +
      "documents_complete, guide_completed, training_sip4_completed, agreement_status, " +
      "ridechecker_jobs_completed, created_at, approved_at, invite_sent_at, invite_accepted_at"
    )
    .eq("role", "ridechecker_active")
    .eq("is_active", true);

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!profiles?.length) {
    return NextResponse.json({ sent: 0, skipped_dedup: 0, skipped_no_match: 0, skipped_no_contact: 0 });
  }

  // Filter to those where pickTemplate selects this template
  const targets = profiles.filter((p) => {
    const picked = pickTemplate(p as EligibilityProfile);
    return picked?.template.key === template_key;
  });

  if (targets.length === 0) {
    return NextResponse.json({
      sent: 0, skipped_dedup: 0, skipped_no_match: profiles.length, skipped_no_contact: 0,
      message: `No active RideCheckers need a "${template.label}" reminder right now.`,
    });
  }

  // Dedup check — fetch all recent logs for this template in one query
  const since = new Date(Date.now() - DEDUP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentLogs } = await supabaseAdmin
    .from("rc_reminder_log")
    .select("ridechecker_id")
    .eq("template_key", template_key)
    .gte("created_at", since);

  const recentlySentIds = new Set((recentLogs ?? []).map((r: any) => r.ridechecker_id));

  let sent = 0, skipped_dedup = 0, skipped_no_contact = 0;
  const insertRows: any[] = [];

  await Promise.all(
    targets.map(async (p) => {
      if (recentlySentIds.has(p.id)) {
        skipped_dedup++;
        return;
      }
      if (!p.email && !p.phone) {
        skipped_no_contact++;
        return;
      }

      const firstName = p.full_name?.split(" ")[0] || "there";
      const picked = pickTemplate(p as EligibilityProfile);
      const detail = picked?.detail;

      let emailSent = false, smsSent = false;

      if (useChannels.includes("email") && p.email) {
        const html = template.emailHtml(firstName, DASHBOARD_URL, detail);
        const r = await sendEmail({ to: p.email, subject: template.subject, html });
        if (r.success) emailSent = true;
      }
      if (useChannels.includes("sms") && p.phone) {
        const body = template.smsBody(firstName, DASHBOARD_URL, detail);
        const r = await sendSMS({ to: p.phone, body });
        if (r.success) smsSent = true;
      }

      if (emailSent || smsSent) {
        sent++;
        insertRows.push({
          ridechecker_id: p.id,
          template_key,
          sent_by: actor.userId,
          channels: useChannels,
          email_sent: emailSent,
          sms_sent: smsSent,
        });
      }
    })
  );

  if (insertRows.length > 0) {
    await supabaseAdmin.from("rc_reminder_log").insert(insertRows);
  }

  return NextResponse.json({
    ok: true,
    template_key,
    template_label: template.label,
    sent,
    skipped_dedup,
    skipped_no_contact,
    skipped_no_match: profiles.length - targets.length,
    total_candidates: targets.length,
  });
}
