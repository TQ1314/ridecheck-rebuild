import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["approve", "mark_paid", "cancel"]),
  notes:  z.string().optional(),
  payment_method: z.string().trim().min(1).optional(),
  payment_reference: z.string().trim().min(1).optional(),
  payment_evidence: z.string().trim().min(1).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { payoutId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { action, notes, payment_method, payment_reference, payment_evidence } = parsed.data;
    const now = new Date().toISOString();

    // Fetch current payout
    const { data: payout, error: fetchErr } = await supabaseAdmin
      .from("ridechecker_payouts")
      .select("id, status, total_pay, ridechecker_id, payment_method, payment_reference, paid_at, paid_by, payout_batch_id")
      .eq("id", params.payoutId)
      .single();

    if (fetchErr || !payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }

    // State machine validation
    if (action === "approve" && payout.status !== "pending") {
      return NextResponse.json({ error: "Only pending payouts can be approved" }, { status: 400 });
    }
    if (action === "mark_paid" && payout.status !== "approved") {
      return NextResponse.json({ error: "Only approved payouts can be marked paid" }, { status: 400 });
    }
    if (action === "mark_paid" && (!payment_method || (!payment_reference && !payment_evidence))) {
      return NextResponse.json(
        { error: "Manual payment requires a payment method and a transaction reference or internal evidence note." },
        { status: 400 },
      );
    }
    if (action === "cancel" && payout.status === "paid") {
      return NextResponse.json({ error: "Paid payouts cannot be cancelled" }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: now };
    if (notes) updates.notes = notes;

    if (action === "approve") {
      updates.status      = "approved";
      updates.approved_at = now;
      updates.approved_by = actor.userId;
    } else if (action === "mark_paid") {
      updates.status  = "paid";
      updates.paid_at = now;
      updates.paid_by = actor.userId;
      updates.payment_method = payment_method;
      updates.payment_reference = payment_reference ?? `INTERNAL_EVIDENCE: ${payment_evidence}`;
    } else if (action === "cancel") {
      updates.status = "cancelled";
    }

    const { error: updateErr } = await supabaseAdmin
      .from("ridechecker_payouts")
      .update(updates)
      .eq("id", params.payoutId);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to update payout" }, { status: 500 });
    }

    await writeAuditLog({
      actorId:   actor.userId,
      actorEmail: actor.email,
      actorRole:  actor.role,
      action:    `payout.${action}`,
      resourceId: params.payoutId,
      newValue:  { status: updates.status, total_pay: payout.total_pay },
    });

    return NextResponse.json({ success: true, status: updates.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
