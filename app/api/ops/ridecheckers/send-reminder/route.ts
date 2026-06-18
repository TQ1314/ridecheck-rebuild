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
  const { ridechecker_id, template_key, channels } = body as {
    ridechecker_id: string;
    template_key?: ReminderTemplateKey;   // optional override; auto-picked if omitted
    channels?: string[];                   // defaults to ["email"]
  };

  if (!ridechecker_id) {
    return NextResponse.json({ error: "ridechecker_id is required" }, { status: 400 });
  }

  // Fetch RC profile
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, full_name, email, phone, service_area, workflow_stage, is_active, " +
      "verification_status, background_check_status, documents_complete, " +
      "guide_completed, training_sip4_completed, agreement_status, " +
      "ridechecker_jobs_completed, created_at, approved_at, " +
      "invite_sent_at, invite_accepted_at"
    )
    .eq("id", ridechecker_id)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "RideChecker not found" }, { status: 404 });
  }
  const p = profile as any;

  // Pick template
  const key: ReminderTemplateKey | null =
    template_key ?? pickTemplate(p as EligibilityProfile)?.template.key ?? null;

  if (!key) {
    return NextResponse.json(
      { error: "No reminder needed — this RideChecker is already dispatch eligible." },
      { status: 400 }
    );
  }

  const template = REMINDER_TEMPLATES[key];
  if (!template) {
    return NextResponse.json({ error: `Unknown template: ${key}` }, { status: 400 });
  }

  // Dedup — don't re-send same template within DEDUP_DAYS
  const since = new Date(Date.now() - DEDUP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from("rc_reminder_log")
    .select("id, created_at")
    .eq("ridechecker_id", ridechecker_id)
    .eq("template_key", key)
    .gte("created_at", since)
    .limit(1);

  if (recent && recent.length > 0) {
    const sentAt = new Date(recent[0].created_at);
    const hoursAgo = Math.round((Date.now() - sentAt.getTime()) / 3600000);
    return NextResponse.json(
      {
        error: `This reminder was already sent ${hoursAgo}h ago. Wait ${DEDUP_DAYS} days before resending.`,
        dedup: true,
        last_sent: recent[0].created_at,
      },
      { status: 429 }
    );
  }

  const useChannels = channels ?? ["email"];
  const firstName = p.full_name?.split(" ")[0] || "there";

  // Resolve detail string (for training/background/one_step_away)
  const picked = pickTemplate(p as EligibilityProfile);
  const detail = picked?.template.key === key ? picked.detail : undefined;

  let emailSent = false;
  let smsSent = false;
  const errors: string[] = [];

  if (useChannels.includes("email") && p.email) {
    const html = template.emailHtml(firstName, DASHBOARD_URL, detail);
    const result = await sendEmail({ to: p.email, subject: template.subject, html });
    if (result.success) emailSent = true;
    else errors.push(`Email failed: ${result.error}`);
  }

  if (useChannels.includes("sms") && p.phone) {
    const body = template.smsBody(firstName, DASHBOARD_URL, detail);
    const result = await sendSMS({ to: p.phone, body });
    if (result.success) smsSent = true;
    else errors.push(`SMS failed: ${result.error}`);
  }

  if (!emailSent && !smsSent) {
    return NextResponse.json(
      { error: "Reminder could not be delivered — no valid email or phone on file.", errors },
      { status: 400 }
    );
  }

  // Log it
  await supabaseAdmin.from("rc_reminder_log").insert({
    ridechecker_id,
    template_key: key,
    sent_by: actor.userId,
    channels: useChannels,
    email_sent: emailSent,
    sms_sent: smsSent,
  });

  return NextResponse.json({
    ok: true,
    template_key: key,
    template_label: template.label,
    email_sent: emailSent,
    sms_sent: smsSent,
    rc_name: p.full_name,
  });
}
