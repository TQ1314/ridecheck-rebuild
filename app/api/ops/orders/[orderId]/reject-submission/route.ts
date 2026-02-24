import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized, writeOrderEvent } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

const rejectSchema = z.object({
  reason: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "admin", "owner", "ops"]);
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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
