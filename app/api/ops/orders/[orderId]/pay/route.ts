import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  base_pay:      z.number().int().min(0).optional(),
  current_offer: z.number().int().min(0).optional(),
  boost_amount:  z.number().int().min(0).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (parsed.data.base_pay      !== undefined) updates.base_pay      = parsed.data.base_pay;
    if (parsed.data.current_offer !== undefined) updates.current_offer = parsed.data.current_offer;
    if (parsed.data.boost_amount  !== undefined) updates.boost_amount  = parsed.data.boost_amount;

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: "No pay fields provided" }, { status: 400 });
    }

    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update(updates)
      .eq("id", params.orderId);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to update pay" }, { status: 500 });
    }

    await Promise.allSettled([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "pay_updated",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: parsed.data,
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.pay_updated",
        resourceId: params.orderId,
        newValue: parsed.data,
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
