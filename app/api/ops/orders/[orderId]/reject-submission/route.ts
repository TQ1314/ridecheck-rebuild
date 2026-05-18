import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized, writeOrderEvent } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
import { emitScoreEvent } from "@/lib/ridechecker/scorecard";

const rejectSchema = z.object({
  reason: z.string().min(1),
});

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { reason } = parsed.data;

    const { data: assignment, error: findError } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .select("*")
      .eq("order_id", params.orderId)
      .eq("status", "submitted")
      .maybeSingle();

    if (findError || !assignment) {
      return NextResponse.json({ error: "No submitted assignment found for this order" }, { status: 404 });
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .update({
        status: "rejected",
        rejected_at: now,
        rejection_reason: reason,
      })
      .eq("id", assignment.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
    }

    await writeOrderEvent({
      orderId: params.orderId,
      eventType: "submission_rejected",
      actorId: actor.userId,
      actorEmail: actor.email,
      details: { reason, ridechecker_id: assignment.ridechecker_id },
      isInternal: true,
    });

    // Mild learning-oriented deduction — recoverable via revision_corrected
    emitScoreEvent({
      ridecheckerId: assignment.ridechecker_id,
      assignmentId: assignment.id,
      orderId: params.orderId,
      eventType: "revision_required",
      customReason: `Revision requested: ${reason.slice(0, 120)}`,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
