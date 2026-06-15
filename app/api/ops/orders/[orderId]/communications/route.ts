/**
 * GET  /api/ops/orders/[orderId]/communications
 * Returns a unified communication timeline for the order, merging:
 *   1. seller_messages        (inbound replies from seller/buyer/RC via webhooks)
 *   2. seller_contact_attempts (outbound ops → seller direct sends)
 *   3. order_events           (buyer_message_sent events = ops → buyer)
 *
 * POST /api/ops/orders/[orderId]/communications
 * Ops sends a message to the buyer. Logs to seller_messages + order_events.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

export interface CommMessage {
  id: string;
  source: "seller_message" | "seller_attempt" | "event";
  direction: "inbound" | "outbound" | "internal";
  sender_type: string;
  recipient_type: string;
  channel: string;
  body: string;
  subject?: string | null;
  status?: string | null;
  is_read?: boolean;
  created_at: string;
  meta?: Record<string, unknown>;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole([
      "operations", "operations_lead", "ops_lead", "admin", "owner", "ops",
    ]);
    if (!isAuthorized(result)) return result.error;

    const orderId = params.orderId;

    // ── 1. seller_messages: all inbound (seller/buyer/RC webhook replies) ──────
    const { data: smRows } = await supabaseAdmin
      .from("seller_messages")
      .select("id, channel, direction, from_address, to_address, subject, body, is_read, created_at, sender_type, recipient_type, status, extracted_dates, extracted_times, extracted_addresses")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    const fromMessages: CommMessage[] = (smRows ?? []).map((r: any) => ({
      id:             `sm:${r.id}`,
      source:         "seller_message",
      direction:      r.direction ?? "inbound",
      sender_type:    r.sender_type ?? (r.direction === "inbound" ? "seller" : "ops"),
      recipient_type: r.recipient_type ?? (r.direction === "inbound" ? "ops" : "seller"),
      channel:        r.channel ?? "unknown",
      body:           r.body ?? "",
      subject:        r.subject ?? null,
      status:         r.status ?? (r.direction === "inbound" ? "received" : "sent"),
      is_read:        r.is_read ?? false,
      created_at:     r.created_at,
      meta: {
        from_address: r.from_address,
        to_address:   r.to_address,
        extracted:    {
          dates:     r.extracted_dates ?? [],
          times:     r.extracted_times ?? [],
          addresses: r.extracted_addresses ?? [],
        },
      },
    }));

    // ── 2. seller_contact_attempts: outbound ops → seller ────────────────────
    const { data: attRows } = await supabaseAdmin
      .from("seller_contact_attempts")
      .select("id, channel, destination, message_body, status, delivery_status, attempt_number, created_at, is_auto_notification")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    const fromAttempts: CommMessage[] = (attRows ?? [])
      .filter((r: any) => !r.is_auto_notification && r.channel !== "buyer_message")
      .map((r: any) => ({
        id:             `sa:${r.id}`,
        source:         "seller_attempt",
        direction:      "outbound",
        sender_type:    "ops",
        recipient_type: "seller",
        channel:        r.channel ?? "unknown",
        body:           r.message_body ?? "",
        status:         r.delivery_status ?? r.status ?? "sent",
        is_read:        true,
        created_at:     r.created_at,
        meta: {
          attempt_number: r.attempt_number,
          destination:    r.destination,
        },
      }));

    // ── 3. order_events: buyer_message_sent → ops → buyer outbound ───────────
    const { data: evRows } = await supabaseAdmin
      .from("order_events")
      .select("id, event_type, details, created_at")
      .eq("order_id", orderId)
      .in("event_type", ["buyer_message_sent", "message.ridechecker_sent", "ridechecker_message_sent"])
      .order("created_at", { ascending: true });

    const fromEvents: CommMessage[] = (evRows ?? []).map((r: any) => {
      const d = r.details ?? {};
      const isBuyer = r.event_type === "buyer_message_sent";
      return {
        id:             `ev:${r.id}`,
        source:         "event",
        direction:      "outbound",
        sender_type:    "ops",
        recipient_type: isBuyer ? "buyer" : "ridechecker",
        channel:        d.channel ?? "both",
        body:           d.message ?? "",
        status:         (d.email_sent || d.sms_sent) ? "sent" : "failed",
        is_read:        true,
        created_at:     r.created_at,
        meta: {
          email_sent: d.email_sent,
          sms_sent:   d.sms_sent,
        },
      };
    });

    // ── Mark all inbound seller_messages read ────────────────────────────────
    const unreadInbound = (smRows ?? []).filter((r: any) => !r.is_read && r.direction === "inbound");
    if (unreadInbound.length > 0) {
      await supabaseAdmin
        .from("seller_messages")
        .update({ is_read: true })
        .eq("order_id", orderId)
        .eq("direction", "inbound")
        .eq("is_read", false);
    }

    // ── Merge + sort ─────────────────────────────────────────────────────────
    const all: CommMessage[] = [
      ...fromMessages,
      ...fromAttempts,
      ...fromEvents,
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return NextResponse.json({
      messages:      all,
      unread_count:  unreadInbound.length,
      total:         all.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const postSchema = z.object({
  message:  z.string().min(1).max(1600),
  channel:  z.enum(["email", "sms", "both"]).default("both"),
  recipient_type: z.enum(["buyer", "seller", "ridechecker"]).default("buyer"),
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
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { message, channel, recipient_type } = parsed.data;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_email, customer_email, buyer_phone, customer_phone, customer_name, vehicle_year, vehicle_make, vehicle_model")
      .eq("id", params.orderId)
      .maybeSingle();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const buyerEmail  = order.buyer_email || order.customer_email;
    const buyerPhone  = order.buyer_phone || order.customer_phone;
    const firstName   = ((order.customer_name as string) || "there").split(" ")[0];
    const vehicleLabel = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;

    const results: Record<string, boolean> = { email: false, sms: false };

    if (recipient_type === "buyer") {
      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="text-align:center;margin-bottom:20px;">
            <h1 style="color:#22774F;margin:0;font-size:24px;">RideCheck</h1>
            <p style="color:#64748b;font-size:13px;margin:4px 0 0;">Pre-Car-Purchase Intelligence</p>
          </div>
          <p style="color:#1e293b;">Hi ${firstName},</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;color:#334155;line-height:1.7;font-size:15px;">${message.replace(/\n/g, "<br/>")}</div>
          <p style="color:#64748b;font-size:13px;">This update is regarding your RideCheck order for the <strong>${vehicleLabel}</strong>.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 12px;" />
          <p style="color:#94a3b8;font-size:12px;text-align:center;">RideCheck — Pre-Car-Purchase Intelligence<br/>Questions? Reply to this email or contact <a href="mailto:support@ridecheckauto.com" style="color:#22774F;">support@ridecheckauto.com</a></p>
        </div>
      `;

      if ((channel === "email" || channel === "both") && buyerEmail) {
        const { sendEmail } = await import("@/lib/notifications/email");
        const r = await sendEmail({
          to: buyerEmail,
          subject: `Update on your RideCheck — ${vehicleLabel}`,
          html: emailHtml,
        });
        results.email = r.success;
      }

      if ((channel === "sms" || channel === "both") && buyerPhone) {
        const { sendSMS } = await import("@/lib/notifications/sms");
        const r = await sendSMS({
          to: buyerPhone,
          body: `RideCheck update for your ${vehicleLabel}: ${message}`,
        });
        results.sms = r.success;
      }
    }

    // Log to order_events for audit
    await writeOrderEvent({
      orderId:    params.orderId,
      eventType:  "buyer_message_sent",
      actorId:    actor.userId,
      actorEmail: actor.email,
      details:    { message, channel, recipient_type, email_sent: results.email, sms_sent: results.sms },
    }).catch(() => {});

    // Also write to seller_messages for the communication center feed
    try {
      await supabaseAdmin.from("seller_messages").insert({
        order_id:       params.orderId,
        channel:        channel === "both" ? (results.email ? "email" : "sms") : channel,
        direction:      "outbound",
        body:           message,
        sender_type:    "ops",
        recipient_type,
        status:         results.email || results.sms ? "sent" : "failed",
        created_by:     actor.userId,
        is_read:        true,
      });
    } catch {
      // non-fatal — communication center feed is best-effort
    }

    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
