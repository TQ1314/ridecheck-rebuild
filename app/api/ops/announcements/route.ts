import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { sendSMS } from "@/lib/notifications/sms";

const OPS_ROLES = ["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"];

// GET /api/ops/announcements — history of past announcements
export async function GET() {
  const auth = await requireRole(OPS_ROLES);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseAdmin
    .from("rc_announcements")
    .select("*, sender:sent_by(full_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: data ?? [] });
}

// POST /api/ops/announcements — send a new group message
export async function POST(req: NextRequest) {
  const auth = await requireRole(OPS_ROLES);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { subject, message, channels, recipient_group, area_filter } = body as {
    subject: string;
    message: string;
    channels: string[];      // ["email", "sms"] or subset
    recipient_group: string; // "all" | "available" | "area"
    area_filter?: string;
  };

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Subject and message are required." }, { status: 400 });
  }
  if (!channels?.length) {
    return NextResponse.json({ error: "Select at least one channel." }, { status: 400 });
  }

  // Build recipient query
  let query = supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, phone")
    .eq("role", "ridechecker_active")
    .eq("is_active", true);

  if (recipient_group === "available") {
    query = query.eq("is_available", true);
  } else if (recipient_group === "area" && area_filter) {
    query = query.ilike("service_area", `%${area_filter}%`);
  }

  const { data: recipients, error: rcErr } = await query;
  if (rcErr) return NextResponse.json({ error: rcErr.message }, { status: 500 });
  if (!recipients?.length) {
    return NextResponse.json({ error: "No RideCheckers match this filter." }, { status: 400 });
  }

  const useEmail = channels.includes("email");
  const useSMS = channels.includes("sms");

  const emailHtml = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1a6b3c">RideCheck Operations Update</h2>
      <p style="white-space:pre-wrap">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#6b7280;font-size:12px">This message was sent to all active RideCheckers by the RideCheck operations team.</p>
    </div>
  `;

  let emailSent = 0, emailFailed = 0, smsSent = 0, smsFailed = 0;

  await Promise.all(
    recipients.map(async (rc) => {
      if (useEmail && rc.email) {
        const result = await sendEmail({ to: rc.email, subject, html: emailHtml });
        if (result.success) emailSent++; else emailFailed++;
      }
      if (useSMS && rc.phone) {
        const smsBody = `RideCheck: ${subject}\n\n${message}`.slice(0, 1600);
        const result = await sendSMS({ to: rc.phone, body: smsBody });
        if (result.success) smsSent++; else smsFailed++;
      }
    })
  );

  // Log the announcement
  const { data: record, error: insertErr } = await (supabaseAdmin
    .from("rc_announcements")
    .insert({
      sent_by: auth.userId,
      subject,
      body: message,
      channels,
      recipient_group: recipient_group ?? "all",
      area_filter: area_filter ?? null,
      recipient_count: recipients.length,
      email_sent: emailSent,
      sms_sent: smsSent,
      email_failed: emailFailed,
      sms_failed: smsFailed,
    })
    .select()
    .single() as any);

  if (insertErr) console.error("[rc_announcements insert]", insertErr);

  return NextResponse.json({
    ok: true,
    recipient_count: recipients.length,
    email_sent: emailSent,
    sms_sent: smsSent,
    email_failed: emailFailed,
    sms_failed: smsFailed,
    id: record?.id,
  });
}
