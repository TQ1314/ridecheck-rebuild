/**
 * GET  /api/admin/orders/[orderId]/seller-replies
 * Returns all inbound seller messages for an order, plus a summary of extracted data.
 *
 * PATCH /api/admin/orders/[orderId]/seller-replies
 * Apply extracted data from a reply to the order fields.
 * Body: { reply_id, apply_date?, apply_time?, apply_address?, mark_read? }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;

    const { data, error } = await supabaseAdmin
      .from("seller_messages")
      .select("*")
      .eq("order_id", params.orderId)
      .eq("direction", "inbound")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    // Also mark all as read
    await supabaseAdmin
      .from("seller_messages")
      .update({ is_read: true })
      .eq("order_id", params.orderId)
      .eq("direction", "inbound")
      .eq("is_read", false);

    return NextResponse.json({ replies: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const patchSchema = z.object({
  reply_id:      z.string().uuid(),
  apply_date:    z.string().optional(),
  apply_time:    z.string().optional(),
  apply_address: z.string().optional(),
  mark_read:     z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body   = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const { reply_id, apply_date, apply_time, apply_address, mark_read } = parsed.data;

    // Mark message read
    if (mark_read !== false) {
      await supabaseAdmin
        .from("seller_messages")
        .update({ is_read: true })
        .eq("id", reply_id);
    }

    // Apply extracted data to order
    const orderUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
    if (apply_date)    orderUpdate.seller_available_date     = apply_date;
    if (apply_time)    orderUpdate.seller_available_time     = apply_time;
    if (apply_address) orderUpdate.seller_inspection_address = apply_address;

    if (Object.keys(orderUpdate).length > 1) {
      await supabaseAdmin
        .from("orders")
        .update(orderUpdate)
        .eq("id", params.orderId);

      await writeAuditLog({
        actorId:    actor.userId,
        actorEmail: actor.email,
        actorRole:  actor.role,
        action:     "order.seller_reply_data_applied",
        resourceId: params.orderId,
        newValue:   { reply_id, ...orderUpdate },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
