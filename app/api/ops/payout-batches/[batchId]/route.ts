import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["mark_completed", "cancel"]),
  notes:  z.string().optional(),
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

    const { action, notes } = parsed.data;
    const now = new Date().toISOString();

    const updates: Record<string, any> = { updated_at: now };
    if (notes) updates.notes = notes;

    if (action === "mark_completed") {
      updates.status       = "completed";
      updates.processed_by = actor.userId;
      updates.processed_at = now;

      // Mark all linked payouts as paid
      const { data: batch } = await supabaseAdmin
        .from("ridechecker_payout_batches")
        .select("id")
        .eq("id", params.batchId)
        .single();

      if (batch) {
        await supabaseAdmin
          .from("ridechecker_payouts")
          .update({
            status:     "paid",
            paid_at:    now,
            paid_by:    actor.userId,
            updated_at: now,
          })
          .eq("payout_batch_id", params.batchId)
          .eq("status", "approved");
      }
    } else if (action === "cancel") {
      updates.status = "cancelled";
    }

    const { error: updateErr } = await supabaseAdmin
      .from("ridechecker_payout_batches")
      .update(updates)
      .eq("id", params.batchId);

    if (updateErr) {
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
