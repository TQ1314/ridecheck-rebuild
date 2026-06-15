import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeOrderEvent } from "@/lib/rbac";
import { sendSMS } from "@/lib/notifications/sms";
import { sendEmail } from "@/lib/notifications/email";
import { CURRENT_AGREEMENT_VERSION } from "@/lib/agreements/rccpa-v1-2026-06";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  ridechecker_id: z.string().uuid(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole([
      "operations", "operations_lead", "ops_lead", "admin", "owner", "ops",
    ]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { ridechecker_id } = parsed.data;

    const { data: rc, error: rcErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone")
      .eq("id", ridechecker_id)
      .maybeSingle();

    if (rcErr || !rc) {
      return NextResponse.json({ error: "RideChecker not found" }, { status: 404 });
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.ridecheckauto.com").replace(/\/$/, "");
    const agreementUrl = `${appUrl}/ridechecker/agreement`;
    const firstName = ((rc as any).full_name ?? "").split(" ")[0] || "RideChecker";

    let smsOk = false;
    let emailOk = false;

    if ((rc as any).phone) {
      const smsResult = await sendSMS({
        to: (rc as any).phone,
        body: `RideCheck: Hi ${firstName}, you must sign the current contractor agreement before receiving job assignments. Sign here: ${agreementUrl}`,
      });
      smsOk = smsResult.success;
    }

    if ((rc as any).email) {
      const emailResult = await sendEmail({
        to: (rc as any).email,
        subject: "Action Required: Sign Your RideCheck Contractor Agreement",
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <h2 style="color:#1a1a1a;margin-bottom:8px">Contractor Agreement Required</h2>
            <p style="color:#444;line-height:1.6">Hi ${firstName},</p>
            <p style="color:#444;line-height:1.6">
              Before you can receive new RideCheck job assignments, you must review and sign the current
              <strong>RideCheck Independent Contractor Compensation &amp; Performance Agreement</strong>
              (version ${CURRENT_AGREEMENT_VERSION}).
            </p>
            <p style="margin:24px 0">
              <a href="${agreementUrl}"
                 style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
                Review and Sign Agreement
              </a>
            </p>
            <p style="color:#888;font-size:13px">
              If you have questions, contact your RideCheck operations team.
            </p>
          </div>
        `,
      });
      emailOk = emailResult.success;
    }

    await writeOrderEvent({
      orderId: params.orderId,
      eventType: "agreement.reminder_sent",
      actorId: actor.userId,
      actorEmail: actor.email,
      details: {
        ridechecker_id,
        ridechecker_name: (rc as any).full_name ?? null,
        ridechecker_email: (rc as any).email ?? null,
        sms_sent: smsOk,
        email_sent: emailOk,
        agreement_version: CURRENT_AGREEMENT_VERSION,
      },
    });

    const channels: string[] = [];
    if (smsOk) channels.push("SMS");
    if (emailOk) channels.push("email");

    if (channels.length === 0) {
      return NextResponse.json(
        { error: "No contact method on file for this RideChecker (no phone or email)." },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, channels, sms_ok: smsOk, email_ok: emailOk });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
