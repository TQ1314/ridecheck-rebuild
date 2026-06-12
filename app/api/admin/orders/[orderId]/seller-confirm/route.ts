/**
 * POST /api/admin/orders/[orderId]/seller-confirm
 *
 * Marks the seller as confirmed — they have agreed to the inspection.
 * Updates:
 *   - orders.seller_contact_status = 'confirmed'
 *   - orders.seller_confirmed_at   = now()
 *
 * Optional body:
 *   { inspection_address?, available_date?, available_time?, notes? }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  inspection_address: z.string().optional(),
  available_date:     z.string().optional(),
  available_time:     z.string().optional(),
  notes:              z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const raw    = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    const data   = parsed.success ? parsed.data : {};

    const now = new Date().toISOString();

    const orderUpdate: Record<string, any> = {
      seller_contact_status: "confirmed",
      seller_confirmed_at:   now,
      updated_at:            now,
    };

    if (data.inspection_address) orderUpdate.seller_inspection_address = data.inspection_address;
    if (data.available_date)     orderUpdate.seller_available_date     = data.available_date;
    if (data.available_time)     orderUpdate.seller_available_time     = data.available_time;
    if (data.notes)              orderUpdate.seller_outcome_notes      = data.notes;

    const { error } = await supabaseAdmin
      .from("orders")
      .update(orderUpdate)
      .eq("id", params.orderId);

    if (error) {
      return NextResponse.json({ error: "DB update failed" }, { status: 500 });
    }

    await Promise.all([
      writeOrderEvent({
        orderId:    params.orderId,
        eventType:  "seller_confirmed",
        actorId:    actor.userId,
        actorEmail: actor.email,
        details:    { ...orderUpdate, updated_by: actor.email },
      }),
      writeAuditLog({
        actorId:    actor.userId,
        actorEmail: actor.email,
        actorRole:  actor.role,
        action:     "order.seller_confirmed",
        resourceId: params.orderId,
        newValue:   orderUpdate,
      }),
    ]);

    return NextResponse.json({ ok: true, confirmed_at: now });
  } catch (err: any) {
    console.error("[seller-confirm]", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}
