import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
import { APPROVED_RECOMMENDATIONS } from "@/lib/legal/constants";

const saveReportSchema = z.object({
  ops_severity_overall: z.enum(["minor", "moderate", "major", "safety_critical"]),
  ops_summary: z.string().min(1),
  ops_report_url: z.string().optional(),
  ops_recommendation: z.enum([...APPROVED_RECOMMENDATIONS] as [string, ...string[]]).optional(),
  issues: z.any().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = saveReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { ops_severity_overall, ops_summary, ops_report_url, ops_recommendation } = parsed.data;

    const updatePayload: Record<string, unknown> = {
      ops_severity_overall,
      ops_summary,
      ops_report_url: ops_report_url || null,
      report_status: "in_review",
      updated_at: new Date().toISOString(),
    };
    if (ops_recommendation !== undefined) {
      updatePayload.ops_recommendation = ops_recommendation;
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", params.orderId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    await Promise.all([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "report_saved",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: { ops_severity_overall, ops_summary },
        isInternal: true,
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.report_saved",
        resourceId: params.orderId,
        newValue: { ops_severity_overall, ops_summary, ops_report_url, ops_recommendation },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
