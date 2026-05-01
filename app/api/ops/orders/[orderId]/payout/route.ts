import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  base_pay:        z.number().int().min(0),
  bonus:           z.number().int().min(0).default(0),
  bonus_breakdown: z.record(z.number()).optional(),
  notes:           z.string().optional(),
});

// POST — create or replace payout record for this order
export async function POST(
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

    // Fetch order to get assigned_ridechecker_id
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, assigned_ridechecker_id, base_pay, boost_amount, current_offer")
      .eq("id", params.orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (!order.assigned_ridechecker_id) {
      return NextResponse.json({ error: "No RideChecker assigned to this order" }, { status: 400 });
    }

    const { base_pay, bonus, bonus_breakdown, notes } = parsed.data;
    const total_pay = base_pay + bonus;
    const now = new Date().toISOString();

    // Upsert — one payout per order (unique constraint on order_id)
    const { data: payout, error: upsertErr } = await supabaseAdmin
      .from("ridechecker_payouts")
      .upsert(
        {
          ridechecker_id:  order.assigned_ridechecker_id,
          order_id:        params.orderId,
          base_pay,
          bonus,
          bonus_breakdown: bonus_breakdown ?? null,
          total_pay,
          status:          "pending",
          notes:           notes ?? null,
          payout_batch_id: null,
          approved_at:     null,
          approved_by:     null,
          paid_at:         null,
          paid_by:         null,
          updated_at:      now,
        },
        { onConflict: "order_id" }
      )
      .select()
      .single();

    if (upsertErr) {
      console.error("[payout create error]", upsertErr);
      return NextResponse.json({ error: "Failed to create payout" }, { status: 500 });
    }

    await Promise.allSettled([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "payout_created",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: { base_pay, bonus, total_pay },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.payout_created",
        resourceId: params.orderId,
        newValue: { base_pay, bonus, total_pay },
      }),
    ]);

    return NextResponse.json({ success: true, payout });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — fetch existing payout for this order
export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;

    const { data: payout, error } = await supabaseAdmin
      .from("ridechecker_payouts")
      .select(`
        *,
        profiles!ridechecker_id (full_name, email)
      `)
      .eq("order_id", params.orderId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Failed to fetch payout" }, { status: 500 });
    }

    if (!payout) {
      return NextResponse.json({ payout: null });
    }

    const mapped = {
      ...payout,
      ridechecker_name:  (payout as any).profiles?.full_name ?? null,
      ridechecker_email: (payout as any).profiles?.email ?? null,
      profiles: undefined,
    };

    return NextResponse.json({ payout: mapped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
