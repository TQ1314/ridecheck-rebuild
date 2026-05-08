import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  payout_ids: z.array(z.string().uuid()).min(1, "Select at least one payout"),
  batch_name: z.string().optional(),
  notes:      z.string().optional(),
});

// POST — create a new batch from selected payout IDs
export async function POST(req: NextRequest) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { payout_ids, batch_name, notes } = parsed.data;
    const now = new Date().toISOString();

    // Validate payouts exist and are approved
    const { data: payouts, error: fetchErr } = await supabaseAdmin
      .from("ridechecker_payouts")
      .select("id, status, total_pay")
      .in("id", payout_ids);

    if (fetchErr || !payouts?.length) {
      return NextResponse.json({ error: "Payouts not found" }, { status: 404 });
    }

    const nonApproved = payouts.filter((p) => p.status !== "approved");
    if (nonApproved.length > 0) {
      return NextResponse.json(
        { error: "All payouts must be approved before batching", non_approved: nonApproved.map((p) => p.id) },
        { status: 400 }
      );
    }

    const total_amount  = payouts.reduce((sum, p) => sum + (p.total_pay ?? 0), 0);
    const payout_count  = payouts.length;
    const auto_name     = batch_name || `Batch ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    // Create batch
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from("ridechecker_payout_batches")
      .insert({
        batch_name:   auto_name,
        total_amount,
        payout_count,
        status:       "pending",
        notes:        notes ?? null,
        created_at:   now,
        updated_at:   now,
      })
      .select()
      .single();

    if (batchErr || !batch) {
      return NextResponse.json({ error: "Failed to create batch" }, { status: 500 });
    }

    // Link payouts to batch
    const { error: linkErr } = await supabaseAdmin
      .from("ridechecker_payouts")
      .update({ payout_batch_id: batch.id, updated_at: now })
      .in("id", payout_ids);

    if (linkErr) {
      return NextResponse.json({ error: "Batch created but failed to link payouts" }, { status: 500 });
    }

    await writeAuditLog({
      actorId:   actor.userId,
      actorEmail: actor.email,
      actorRole:  actor.role,
      action:    "payout_batch.created",
      resourceId: batch.id,
      newValue:  { payout_ids, total_amount, payout_count },
    });

    return NextResponse.json({ success: true, batch });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — list all batches
export async function GET(req: NextRequest) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;

    const { data: batches, error } = await supabaseAdmin
      .from("ridechecker_payout_batches")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch batches" }, { status: 500 });
    }

    return NextResponse.json({ batches: batches ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
