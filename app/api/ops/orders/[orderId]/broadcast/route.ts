import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { hasSignedCurrentAgreement, CURRENT_AGREEMENT_VERSION } from "@/lib/agreements/rccpa-v1-2026-06";
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

    // Agreement gate — check all selected RideCheckers have signed the current agreement
    const { data: rcProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, agreement_status, current_agreement_version")
      .in("id", ridechecker_ids);

    const unsignedRcs = (rcProfiles ?? []).filter(
      (rc) => !hasSignedCurrentAgreement(rc as any)
    );
    const eligibleIds = ridechecker_ids.filter(
      (id) => !unsignedRcs.some((u) => u.id === id)
    );

    if (eligibleIds.length === 0) {
      const names = unsignedRcs.map((u) => u.full_name || u.id).join(", ");
      return NextResponse.json(
        {
          error: `None of the selected RideCheckers have signed the current contractor agreement (${CURRENT_AGREEMENT_VERSION}). Unsigned: ${names}`,
          unsigned_ridecheckers: unsignedRcs.map((u) => ({ id: u.id, full_name: u.full_name })),
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Expire any existing open broadcasts for this order
    await supabaseAdmin
      .from("job_broadcasts")
      .update({ status: "expired", updated_at: now })
      .eq("order_id", params.orderId)
      .eq("status", "sent");

    // Insert new broadcast rows — only for agreement-eligible RideCheckers
    const rows = eligibleIds.map((rcId) => ({
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

        const { ridecheckerJobOfferHtml } = await import(
          "@/lib/email/templates/ridecheckerJobOffer"
        );

        // Fetch order vehicle details for the email
        const { data: orderDetails } = await supabaseAdmin
          .from("orders")
          .select("order_id, order_number, vehicle_year, vehicle_make, vehicle_model")
          .eq("id", params.orderId)
          .maybeSingle();

        await Promise.allSettled(
          rcs.flatMap((rc) => {
            const firstName = rc.full_name?.split(" ")[0] || "there";
            const emailHtml = ridecheckerJobOfferHtml({
              firstName,
              offeredPay:   offered_pay,
              vehicleYear:  (orderDetails as any)?.vehicle_year  ?? null,
              vehicleMake:  (orderDetails as any)?.vehicle_make  ?? null,
              vehicleModel: (orderDetails as any)?.vehicle_model ?? null,
              orderId:      (orderDetails as any)?.order_id      ?? null,
              dashboardUrl: jobUrl,
            });
            const { buildReplyTo } = await import("@/lib/notifications/replyToAddress");
            const notifs: Promise<any>[] = [
              sendEmail({
                to: rc.email,
                subject: "New RideCheck Job Available — Quick Response Needed",
                html: emailHtml,
                replyTo: buildReplyTo((orderDetails as any)?.order_number ?? null),
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
