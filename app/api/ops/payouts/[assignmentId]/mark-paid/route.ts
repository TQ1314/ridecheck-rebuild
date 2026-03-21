import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

const markPaidSchema = z.object({
  notes: z.string().optional(),
  method: z.string().optional(),
}).optional();

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { assignmentId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    let notes: string | undefined;
    let method: string | undefined;

    try {
      const body = await req.json();
      const parsed = markPaidSchema.safeParse(body);
      if (parsed.success && parsed.data) {
        notes = parsed.data.notes;
        method = parsed.data.method;
      }
    } catch {
    }

    const { data: assignment, error: findError } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .select("*")
      .eq("id", params.assignmentId)
      .eq("payout_status", "pending")
      .in("status", ["approved", "paid"])
      .maybeSingle();

    if (findError || !assignment) {
      return NextResponse.json({ error: "No eligible assignment found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .update({
        payout_status: "released",
        paid_at: now,
        payout_method: method || "manual",
        payout_notes: notes || null,
        status: "paid",
      })
      .eq("id", params.assignmentId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
    }

    await supabaseAdmin
      .from("ridechecker_earnings")
      .update({
        status: "paid",
        paid_at: now,
      })
      .eq("order_id", assignment.order_id)
      .eq("ridechecker_id", assignment.ridechecker_id);

    await writeAuditLog({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "payout.marked_paid",
      resourceId: params.assignmentId,
      newValue: {
        payout_amount: assignment.payout_amount,
        method: method || "manual",
        ridechecker_id: assignment.ridechecker_id,
        order_id: assignment.order_id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
