import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  ridechecker_ids: z.array(z.string().uuid()).min(1, "Select at least one RideChecker"),
  offered_pay: z.number().int().min(0),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { ridechecker_ids, offered_pay } = parsed.data;

    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_id")
      .eq("id", params.orderId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Expire any existing open broadcasts for this order
    await supabaseAdmin
      .from("job_broadcasts")
      .update({ status: "expired", updated_at: now })
      .eq("order_id", params.orderId)
      .eq("status", "sent");

    // Insert new broadcast rows
    const rows = ridechecker_ids.map((rcId) => ({
      order_id: params.orderId,
      ridechecker_id: rcId,
      status: "sent" as const,
      offered_pay,
      created_at: now,
      updated_at: now,
    }));

    const { error: insertErr } = await supabaseAdmin
      .from("job_broadcasts")
      .insert(rows);

    if (insertErr) {
      return NextResponse.json({ error: "Failed to create broadcasts" }, { status: 500 });
    }

    // Update order assignment_status to reflect broadcast is out
    await supabaseAdmin
      .from("orders")
      .update({
        assignment_status: "assigned",
        current_offer: offered_pay,
        updated_at: now,
      })
      .eq("id", params.orderId);

    // Best-effort: notify each RideChecker by email
    try {
      const { data: rcs } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name, phone")
        .in("id", ridechecker_ids);

      if (rcs && rcs.length > 0) {
        const { sendEmail } = await import("@/lib/notifications/email");
        const { sendSMS } = await import("@/lib/notifications/sms");
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";
        const jobUrl = `${appUrl}/ridechecker/dashboard`;

        await Promise.allSettled(
          rcs.flatMap((rc) => {
            const firstName = rc.full_name?.split(" ")[0] || "there";
            const emailHtml = `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <div style="text-align:center;margin-bottom:20px;">
                  <h1 style="color:#22774F;margin:0;font-size:24px;">RideCheck</h1>
                  <p style="color:#64748b;font-size:13px;margin:4px 0 0;">Field Inspection Network</p>
                </div>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:18px;margin-bottom:20px;">
                  <p style="font-weight:700;color:#166534;margin:0 0 4px;font-size:16px;">A new job is available near you</p>
                  <p style="color:#15803d;margin:0;font-size:13px;">First to accept wins the job. Act fast.</p>
                </div>
                <p style="color:#1e293b;">Hi ${firstName},</p>
                <p style="color:#475569;line-height:1.6;">A new vehicle assessment job has been sent to you. The offered pay is <strong>$${offered_pay}</strong>. Log in to your RideCheck dashboard to view details and accept.</p>
                <p style="text-align:center;margin:24px 0;">
                  <a href="${jobUrl}" style="display:inline-block;background:#22774F;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:700;">View &amp; Accept Job</a>
                </p>
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 12px;" />
                <p style="color:#94a3b8;font-size:12px;text-align:center;">RideCheck — Pre-Car-Purchase Intelligence<br/>Questions? <a href="mailto:support@ridecheckauto.com" style="color:#22774F;">support@ridecheckauto.com</a></p>
              </div>
            `;
            const notifs: Promise<any>[] = [
              sendEmail({
                to: rc.email,
                subject: "New RideCheck Job Available — Quick Response Needed",
                html: emailHtml,
              }),
            ];
            if ((rc as any).phone) {
              const smsBody = `RideCheck: Hi ${firstName}, a new job ($${offered_pay}) is available near you — first to accept wins. Check your dashboard: ${jobUrl}`;
              notifs.push(sendSMS({ to: (rc as any).phone, body: smsBody }));
            }
            return notifs;
          })
        );
      }
    } catch {
      // notifications are best-effort, don't fail the response
    }

    await Promise.allSettled([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "job_broadcast_sent",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: { ridechecker_count: ridechecker_ids.length, offered_pay },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.job_broadcast_sent",
        resourceId: params.orderId,
        newValue: { ridechecker_ids, offered_pay },
      }),
    ]);

    return NextResponse.json({ success: true, sent_to: ridechecker_ids.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: fetch broadcasts for an order
export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;

    const { data: broadcasts, error } = await supabaseAdmin
      .from("job_broadcasts")
      .select(`
        *,
        profiles!ridechecker_id (full_name, email)
      `)
      .eq("order_id", params.orderId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch broadcasts" }, { status: 500 });
    }

    const mapped = (broadcasts || []).map((b: any) => ({
      ...b,
      ridechecker_name: b.profiles?.full_name ?? null,
      ridechecker_email: b.profiles?.email ?? null,
      profiles: undefined,
    }));

    return NextResponse.json({ broadcasts: mapped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
