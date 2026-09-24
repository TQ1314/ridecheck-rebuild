import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { validateBatchChildren } from "@/lib/payout/batch";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["mark_completed", "cancel"]),
  notes:  z.string().optional(),
  payment_reference: z.string().trim().min(1).optional(),
  payment_evidence: z.string().trim().min(1).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { batchId: string } }
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

    const { action, notes, payment_reference, payment_evidence } = parsed.data;
    const now = new Date().toISOString();

    const updates: Record<string, any> = { updated_at: now };
    let completedChildren: Array<{ id: string }> = [];
    const paymentRef = payment_reference ?? `INTERNAL_EVIDENCE: ${payment_evidence}`;
    if (notes) updates.notes = notes;

    if (action === "mark_completed") {
      if (!payment_reference && !payment_evidence) {
        return NextResponse.json({ error: "A batch payment reference or internal evidence note is required." }, { status: 400 });
      }
      const { data: currentBatch, error: batchErr } = await supabaseAdmin
        .from("ridechecker_payout_batches")
        .select("id, status")
        .eq("id", params.batchId)
        .single();
      if (batchErr || !currentBatch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
      if (currentBatch.status !== "pending") {
        return NextResponse.json({ error: "Only pending batches can be completed." }, { status: 409 });
      }
      const { data: batch } = await supabaseAdmin
        .from("ridechecker_payout_batches")
        .select("id, payout_count")
        .eq("id", params.batchId)
        .single();
      if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

      const { data: children, error: childrenErr } = await supabaseAdmin
        .from("ridechecker_payouts")
        .select("id, status")
        .eq("payout_batch_id", params.batchId);
      if (childrenErr) return NextResponse.json({ error: "Unable to verify batch payouts; batch remains pending." }, { status: 503 });
      const validationError = validateBatchChildren(children ?? [], batch.payout_count);
      if (validationError) return NextResponse.json({ error: validationError }, { status: 409 });

      // Update only approved rows and ask PostgREST to return the affected
      // rows. A concurrent approval/payment can therefore never be silently
      // treated as successful.
      const { data: paidChildren, error: childUpdateErr } = await supabaseAdmin
        .from("ridechecker_payouts")
        .update({
          status: "paid", paid_at: now, paid_by: actor.userId,
          payment_reference: paymentRef, updated_at: now,
        })
        .eq("payout_batch_id", params.batchId)
        .eq("status", "approved")
        .select("id");
      if (childUpdateErr || (paidChildren?.length ?? 0) !== children.length) {
        // Best-effort compensation for a partial update. Restrict rollback to
        // this exact operation so we cannot overwrite an unrelated payment.
        const { error: rollbackErr } = await supabaseAdmin
          .from("ridechecker_payouts")
          .update({ status: "approved", paid_at: null, paid_by: null, payment_reference: null, updated_at: new Date().toISOString() })
          .eq("payout_batch_id", params.batchId)
          .eq("status", "paid")
          .eq("paid_by", actor.userId)
          .eq("paid_at", now)
          .eq("payment_reference", paymentRef);
        if (rollbackErr) {
          return NextResponse.json({ error: "Batch payment partially failed and rollback also failed; batch remains pending for manual reconciliation." }, { status: 500 });
        }
        return NextResponse.json({ error: "Not all batch payouts were paid; batch remains pending." }, { status: 409 });
      }
      completedChildren = (children ?? []).map((child) => ({ id: child.id }));
      // Batch schema is intentionally unchanged: retain the manual evidence
      // in the existing notes field rather than requiring an unverified DDL.
      updates.notes = [notes, `Payment evidence: ${paymentRef}`].filter(Boolean).join("\n");
      updates.status = "completed";
      updates.processed_by = actor.userId;
      updates.processed_at = now;
    } else if (action === "cancel") {
      updates.status = "cancelled";
    }

    const { data: completedBatch, error: updateErr } = await supabaseAdmin
      .from("ridechecker_payout_batches")
      .update(updates)
      .eq("id", params.batchId)
      .eq("status", action === "mark_completed" ? "pending" : "pending")
      .select("id")
      .maybeSingle();

    if (updateErr || !completedBatch) {
      if (action === "mark_completed") {
        const { error: rollbackErr } = await supabaseAdmin
          .from("ridechecker_payouts")
          .update({ status: "approved", paid_at: null, paid_by: null, payment_reference: null, updated_at: new Date().toISOString() })
          .in("id", completedChildren.map((child) => child.id))
          .eq("status", "paid")
          .eq("paid_by", actor.userId)
          .eq("paid_at", now)
          .eq("payment_reference", paymentRef);
        if (rollbackErr) {
          return NextResponse.json({ error: "Batch parent update failed and child rollback failed; manual reconciliation required." }, { status: 500 });
        }
        return NextResponse.json({ error: "Batch parent update failed; child payouts were rolled back." }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to update batch" }, { status: 500 });
    }

    await writeAuditLog({
      actorId:   actor.userId,
      actorEmail: actor.email,
      actorRole:  actor.role,
      action:    `payout_batch.${action}`,
      resourceId: params.batchId,
      newValue:  { status: updates.status },
    });

    return NextResponse.json({ success: true, status: updates.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
