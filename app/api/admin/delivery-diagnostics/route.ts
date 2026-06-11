/**
 * GET /api/admin/delivery-diagnostics
 *
 * Returns paginated seller_contact_attempts with order metadata, delivery status,
 * and computed latency. Also returns global stats (across all tracked attempts).
 *
 * Query params:
 *   channel   — "all" | "email" | "sms"           default: "all"
 *   status    — "all" | "queued" | "sent" | "delivered" | "bounced" | "failed" | "undeliverable"
 *   tracked   — "tracked" | "untracked" | "all"   default: "tracked"
 *   search    — provider_message_id / order_id (UUID) / destination (ilike)
 *   limit     — default 50, max 200
 *   offset    — default 0
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;

    const sp = req.nextUrl.searchParams;
    const channel     = sp.get("channel")  ?? "all";
    const statusParam = sp.get("status")   ?? "all";
    const tracked     = sp.get("tracked")  ?? "tracked";
    const search      = sp.get("search")   ?? "";
    const limit       = Math.min(parseInt(sp.get("limit")  ?? "50",  10), 200);
    const offset      = Math.max(parseInt(sp.get("offset") ?? "0",   10), 0);

    // ── 1. Global stats (always across all tracked attempts, no other filters) ──
    const { data: statsRows } = await supabaseAdmin
      .from("seller_contact_attempts")
      .select("delivery_status, channel")
      .not("delivery_status", "is", null);

    const statsAll = statsRows || [];
    const stats = {
      total:         statsAll.length,
      delivered:     statsAll.filter(r => r.delivery_status === "delivered").length,
      queued:        statsAll.filter(r => r.delivery_status === "queued").length,
      sent:          statsAll.filter(r => r.delivery_status === "sent").length,
      bounced:       statsAll.filter(r => r.delivery_status === "bounced").length,
      failed:        statsAll.filter(r => r.delivery_status === "failed").length,
      undeliverable: statsAll.filter(r => r.delivery_status === "undeliverable").length,
      by_channel: {
        email: statsAll.filter(r => r.channel === "email").length,
        sms:   statsAll.filter(r => r.channel === "sms").length,
      },
    };

    // ── 2. Paginated query ──
    let query = supabaseAdmin
      .from("seller_contact_attempts")
      .select(
        `id, order_id, attempt_number, channel, destination,
         message_template_key, message_body, status,
         created_at, provider_message_id, delivery_status,
         delivery_updated_at, is_auto_notification,
         orders ( vehicle_year, vehicle_make, vehicle_model )`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter: tracking state
    if (tracked === "tracked")   query = query.not("delivery_status", "is", null);
    if (tracked === "untracked") query = query.is("delivery_status", null);

    // Filter: channel
    if (channel !== "all") query = query.eq("channel", channel);

    // Filter: delivery_status
    if (statusParam !== "all") query = query.eq("delivery_status", statusParam);

    // Filter: search
    if (search.trim()) {
      const s = search.trim();
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
      if (isUUID) {
        query = query.eq("order_id", s);
      } else {
        query = query.or(
          `provider_message_id.ilike.%${s}%,destination.ilike.%${s}%`
        );
      }
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("[delivery-diagnostics] query error", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    // ── 3. Flatten order join + compute latency ──
    const attempts = (data || []).map((row: any) => {
      const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
      const sentMs      = row.created_at        ? new Date(row.created_at).getTime()        : null;
      const updatedMs   = row.delivery_updated_at ? new Date(row.delivery_updated_at).getTime() : null;
      const latency_seconds =
        sentMs && updatedMs && updatedMs > sentMs
          ? Math.round((updatedMs - sentMs) / 1000)
          : null;

      return {
        id:                   row.id,
        order_id:             row.order_id,
        attempt_number:       row.attempt_number,
        channel:              row.channel,
        destination:          row.destination,
        message_template_key: row.message_template_key,
        message_body:         row.message_body,
        status:               row.status,
        created_at:           row.created_at,
        provider_message_id:  row.provider_message_id,
        delivery_status:      row.delivery_status,
        delivery_updated_at:  row.delivery_updated_at,
        is_auto_notification: row.is_auto_notification,
        vehicle_year:         order?.vehicle_year  ?? null,
        vehicle_make:         order?.vehicle_make  ?? null,
        vehicle_model:        order?.vehicle_model ?? null,
        latency_seconds,
      };
    });

    return NextResponse.json({
      attempts,
      total:  count ?? 0,
      stats,
    });
  } catch (err: any) {
    console.error("[delivery-diagnostics] unexpected error", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}
