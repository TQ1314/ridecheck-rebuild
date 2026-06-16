/**
 * GET  /api/ops/orders/[orderId]/communications
 * Returns a unified communication timeline for the order, merging:
 *   1. seller_messages        — real inbound/outbound message content (all parties)
 *   2. seller_contact_attempts — legacy outbound ops→seller direct sends
 *   3. order_events           — system events (payment, assignment, report, etc.)
 *
 * POST /api/ops/orders/[orderId]/communications
 * Ops sends a message to the buyer. Mirrors to seller_messages + order_events.
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

// ── Event types pulled into the communication timeline ─────────────────────────
const COMM_EVENT_TYPES = [
  // Buyer
  "buyer_message_sent",
  "payment_requested",
  "payment_synced",
  "payment_manually_verified",
  "payment_override_approved",
  "report_delivered",
  "report_sent",
  "ridechecker_credit_transferred",
  // RideChecker
  "ridechecker_assigned",
  "ridechecker_accepted",
  "ridechecker_declined",
  "ridechecker_assignment_cancelled",
  "ridechecker_unassigned",
  "ridechecker_nudged",
  "ridechecker_message_sent",
  "message.ridechecker_sent",
  "ops_message_to_ridechecker",
  "job_broadcast_sent",
  "payout_created",
  "agreement.reminder_sent",
  "revision_required",
  "report_qa_approved",
  "qa_review",
  // Seller
  "seller_confirmed",
  "seller_refused_inspection",
  "seller_outreach_reopened",
  "seller_contact_outcome",
  "seller_reply_received",
  "buyer_reply_received",
  "ridechecker_reply_received",
  "seller_availability_provided",
  "seller_inspection_address_provided",
  // System
  "status_changed",
  "report_generated",
];

/** Normalize an order_event row into a CommMessage */
function eventToMessage(ev: {
  id: string;
  event_type: string;
  details: Record<string, any> | null;
  created_at: string;
}): CommMessage {
  const d = ev.details ?? {};
  const base = { id: `ev:${ev.id}`, source: "event" as const, is_read: true, created_at: ev.created_at, meta: d };

  switch (ev.event_type) {
    // ── Buyer outbound messages ─────────────────────────────────────────
    case "buyer_message_sent":
      return { ...base, direction: "outbound", sender_type: "ops", recipient_type: "buyer",
        channel: d.channel || "both", body: d.message || "(message sent)",
        status: d.email_sent || d.sms_sent ? "sent" : "failed" };
    case "payment_requested":
      return { ...base, direction: "outbound", sender_type: "system", recipient_type: "buyer",
        channel: "email", body: `Payment link sent to buyer${d.amount ? ` — $${Number(d.amount).toFixed(2)}` : ""}`,
        status: "sent" };
    case "payment_synced":
      return { ...base, direction: "internal", sender_type: "system", recipient_type: "ops",
        channel: "in_app", body: `Payment received${d.amount ? ` — $${Number(d.amount).toFixed(2)}` : ""}`, status: "received" };
    case "payment_manually_verified":
      return { ...base, direction: "internal", sender_type: "ops", recipient_type: "ops",
        channel: "in_app", body: `Payment manually verified${d.reason ? ` — ${d.reason}` : ""}`, status: "received" };
    case "payment_override_approved":
      return { ...base, direction: "internal", sender_type: "ops", recipient_type: "ops",
        channel: "in_app", body: `Payment override approved${d.reason ? ` — ${d.reason}` : ""}`, status: "received" };
    case "report_delivered":
      return { ...base, direction: "outbound", sender_type: "system", recipient_type: "buyer",
        channel: "email", body: `Intelligence report delivered to buyer${d.delivered_to ? ` (${d.delivered_to})` : ""}`, status: "sent" };
    case "report_sent":
      return { ...base, direction: "outbound", sender_type: "system", recipient_type: "buyer",
        channel: "email", body: "Report sent to buyer", status: "sent" };
    case "ridechecker_credit_transferred":
      return { ...base, direction: "internal", sender_type: "system", recipient_type: "buyer",
        channel: "in_app", body: "Transferable RideCheck credit applied to order", status: "received" };

    // ── RideChecker events ──────────────────────────────────────────────
    case "ridechecker_assigned":
      return { ...base, direction: "outbound", sender_type: "ops", recipient_type: "ridechecker",
        channel: "in_app", body: `Job offered to ${d.ridechecker_name || "RideChecker"} — 15 min to accept`,
        status: "sent" };
    case "ridechecker_accepted":
      return { ...base, direction: "inbound", sender_type: "ridechecker", recipient_type: "ops",
        channel: "in_app", body: `${d.ridechecker_name || "RideChecker"} accepted the job`, status: "received" };
    case "ridechecker_declined":
      return { ...base, direction: "inbound", sender_type: "ridechecker", recipient_type: "ops",
        channel: "in_app", body: `${d.ridechecker_name || "RideChecker"} declined the job${d.reason ? ` — "${d.reason}"` : ""}`,
        status: "received" };
    case "ridechecker_assignment_cancelled":
      return { ...base, direction: "internal", sender_type: "ops", recipient_type: "ridechecker",
        channel: "in_app", body: `Assignment recalled — ${d.ridechecker_name || "RideChecker"} unassigned`, status: "sent" };
    case "ridechecker_unassigned":
      return { ...base, direction: "internal", sender_type: "ops", recipient_type: "ridechecker",
        channel: "in_app", body: `RideChecker unassigned${d.reason ? ` — ${d.reason}` : ""}`, status: "sent" };
    case "ridechecker_nudged":
      return { ...base, direction: "outbound", sender_type: "ops", recipient_type: "ridechecker",
        channel: d.sms_sent ? "sms" : "email", body: `Acceptance reminder sent to ${d.ridechecker_name || "RideChecker"}`,
        status: "sent" };
    case "ridechecker_message_sent":
    case "message.ridechecker_sent":
      return { ...base, direction: "outbound", sender_type: "ridechecker", recipient_type: "ops",
        channel: "in_app", body: d.message || "(message sent)", status: "received" };
    case "ops_message_to_ridechecker":
      return { ...base, direction: "outbound", sender_type: "ops", recipient_type: "ridechecker",
        channel: d.email_sent ? "email" : "sms", body: d.message || "(no message body)", status: "sent" };
    case "job_broadcast_sent":
      return { ...base, direction: "outbound", sender_type: "ops", recipient_type: "ridechecker",
        channel: "in_app", body: `Job broadcast sent to ${d.recipient_count || "multiple"} RideCheckers`, status: "sent" };
    case "payout_created":
      return { ...base, direction: "internal", sender_type: "system", recipient_type: "ridechecker",
        channel: "in_app", body: `Payout created${d.amount ? ` — $${Number(d.amount).toFixed(2)}` : ""}`, status: "received" };
    case "agreement.reminder_sent":
      return { ...base, direction: "outbound", sender_type: "ops", recipient_type: "ridechecker",
        channel: d.sms_sent && d.email_sent ? "both" : d.sms_sent ? "sms" : "email",
        body: `Agreement reminder sent to ${d.ridechecker_name || "RideChecker"}`, status: "sent" };
    case "revision_required":
      return { ...base, direction: "outbound", sender_type: "ops", recipient_type: "ridechecker",
        channel: "in_app", body: `QA revision required${d.reason ? ` — ${d.reason}` : ""}`, status: "sent" };
    case "report_qa_approved":
      return { ...base, direction: "internal", sender_type: "ops", recipient_type: "ops",
        channel: "in_app", body: "Report approved by QA", status: "received" };
    case "qa_review":
      return { ...base, direction: "internal", sender_type: "ops", recipient_type: "ops",
        channel: "in_app", body: `QA review — ${d.decision || "completed"}`, status: "received" };

    // ── Seller events ───────────────────────────────────────────────────
    case "seller_confirmed":
      return { ...base, direction: "inbound", sender_type: "seller", recipient_type: "ops",
        channel: "in_app", body: `Seller confirmed inspection${d.inspection_address ? ` at ${d.inspection_address}` : ""}`,
        status: "received" };
    case "seller_refused_inspection":
      return { ...base, direction: "inbound", sender_type: "seller", recipient_type: "ops",
        channel: "in_app", body: `Seller refused inspection${d.reason ? ` — ${d.reason}` : ""}`, status: "received" };
    case "seller_outreach_reopened":
      return { ...base, direction: "internal", sender_type: "ops", recipient_type: "seller",
        channel: "in_app", body: `Seller outreach reopened${d.reason ? ` — ${d.reason}` : ""}`, status: "sent" };
    case "seller_contact_outcome":
      return { ...base, direction: "internal", sender_type: "ops", recipient_type: "ops",
        channel: "in_app", body: `Seller contact outcome: ${d.outcome || "recorded"}${d.notes ? ` — ${d.notes}` : ""}`,
        status: "received" };
    case "seller_reply_received":
      return { ...base, direction: "inbound", sender_type: "seller", recipient_type: "ops",
        channel: d.channel || "email", body: d.body_preview || "(email reply)", status: "received" };
    case "buyer_reply_received":
      return { ...base, direction: "inbound", sender_type: "buyer", recipient_type: "ops",
        channel: d.channel || "email", body: d.body_preview || "(email reply)", status: "received" };
    case "ridechecker_reply_received":
      return { ...base, direction: "inbound", sender_type: "ridechecker", recipient_type: "ops",
        channel: d.channel || "email", body: d.body_preview || "(email reply)", status: "received" };
    case "seller_availability_provided":
      return { ...base, direction: "inbound", sender_type: "seller", recipient_type: "ops",
        channel: d.channel || "email",
        body: `Seller provided availability${d.body_preview ? ` — "${d.body_preview}"` : ""}`, status: "received" };
    case "seller_inspection_address_provided":
      return { ...base, direction: "inbound", sender_type: "seller", recipient_type: "ops",
        channel: d.channel || "email",
        body: `Seller provided inspection address${d.body_preview ? ` — "${d.body_preview}"` : ""}`, status: "received" };

    // ── System ──────────────────────────────────────────────────────────
    case "status_changed":
      return { ...base, direction: "internal", sender_type: "system", recipient_type: "ops",
        channel: "in_app", body: `Order status → ${d.new_status || d.status || "updated"}`, status: "received" };
    case "report_generated":
      return { ...base, direction: "internal", sender_type: "system", recipient_type: "ops",
        channel: "in_app", body: "Intelligence report generated", status: "received" };

    default:
      return { ...base, direction: "internal", sender_type: "system", recipient_type: "ops",
        channel: "in_app", body: ev.event_type.replace(/_/g, " "), status: "received" };
  }
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

    // ── 1. seller_messages: all real message content (inbound + outbound) ──
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
        extracted: {
          dates:     r.extracted_dates ?? [],
          times:     r.extracted_times ?? [],
          addresses: r.extracted_addresses ?? [],
        },
      },
    }));

    // ── 2. seller_contact_attempts: legacy outbound ops→seller sends ────
    const { data: attRows } = await supabaseAdmin
      .from("seller_contact_attempts")
      .select("id, channel, destination, message_body, status, delivery_status, attempt_number, created_at, is_auto_notification")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    // Skip auto-notifications and buyer_message channel (handled by seller_messages now)
    // Also skip if there's already a seller_messages outbound row with same created_at range (dedup)
    const outboundSmCreatedAts = new Set(
      fromMessages
        .filter((m) => m.direction === "outbound" && m.sender_type === "ops" && m.source === "seller_message")
        .map((m) => m.created_at.slice(0, 16)) // minute-level granularity for dedup
    );

    const fromAttempts: CommMessage[] = (attRows ?? [])
      .filter((r: any) => !r.is_auto_notification && r.channel !== "buyer_message")
      .filter((r: any) => !outboundSmCreatedAts.has((r.created_at ?? "").slice(0, 16)))
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
        meta: { attempt_number: r.attempt_number, destination: r.destination },
      }));

    // ── 3. order_events: comprehensive timeline ─────────────────────────
    const { data: evRows } = await supabaseAdmin
      .from("order_events")
      .select("id, event_type, details, created_at")
      .eq("order_id", orderId)
      .in("event_type", COMM_EVENT_TYPES)
      .order("created_at", { ascending: true });

    // De-duplicate events that already appear in seller_messages
    // (buyer_message_sent / ops_message_to_ridechecker events written before seller_messages mirroring)
    const DEDUP_EVENT_TYPES = new Set([
      "buyer_message_sent", "ops_message_to_ridechecker",
    ]);
    const fromEvents: CommMessage[] = (evRows ?? [])
      .filter((r: any) => {
        if (!DEDUP_EVENT_TYPES.has(r.event_type)) return true;
        // Skip if there's already a seller_messages row at the same minute
        return !outboundSmCreatedAts.has((r.created_at ?? "").slice(0, 16));
      })
      .map((r: any) =>
        eventToMessage({ id: r.id, event_type: r.event_type, details: r.details, created_at: r.created_at })
      );

    // ── Mark unread inbound seller_messages as read ─────────────────────
    const unreadInbound = (smRows ?? []).filter((r: any) => !r.is_read && r.direction === "inbound");
    if (unreadInbound.length > 0) {
      await supabaseAdmin
        .from("seller_messages")
        .update({ is_read: true })
        .eq("order_id", orderId)
        .eq("direction", "inbound")
        .eq("is_read", false);
    }

    // ── Merge + sort ────────────────────────────────────────────────────
    const all: CommMessage[] = [
      ...fromMessages,
      ...fromAttempts,
      ...fromEvents,
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return NextResponse.json({
      messages:     all,
      unread_count: unreadInbound.length,
      total:        all.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const postSchema = z.object({
  message:        z.string().min(1).max(1600),
  channel:        z.enum(["email", "sms", "both"]).default("both"),
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
      .select("id, order_number, buyer_email, customer_email, buyer_phone, customer_phone, customer_name, vehicle_year, vehicle_make, vehicle_model")
      .eq("id", params.orderId)
      .maybeSingle();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const buyerEmail  = order.buyer_email || order.customer_email;
    const buyerPhone  = order.buyer_phone || order.customer_phone;
    const firstName   = ((order.customer_name as string) || "there").split(" ")[0];
    const vehicleLabel = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;

    // Reply-to so buyer/RC replies route back into RideCheck
    const { buildReplyTo } = await import("@/lib/notifications/replyToAddress");
    const replyTo = buildReplyTo((order as any).order_number ?? null);

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
        const r = await sendEmail({ to: buyerEmail, subject: `Update on your RideCheck — ${vehicleLabel}`, html: emailHtml, replyTo });
        results.email = r.success;
      }
      if ((channel === "sms" || channel === "both") && buyerPhone) {
        const { sendSMS } = await import("@/lib/notifications/sms");
        const r = await sendSMS({ to: buyerPhone, body: `RideCheck update for your ${vehicleLabel}: ${message}` });
        results.sms = r.success;
      }
    }

    await writeOrderEvent({
      orderId:    params.orderId,
      eventType:  "buyer_message_sent",
      actorId:    actor.userId,
      actorEmail: actor.email,
      details:    { message, channel, recipient_type, email_sent: results.email, sms_sent: results.sms },
    }).catch(() => {});

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
      // non-fatal
    }

    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
