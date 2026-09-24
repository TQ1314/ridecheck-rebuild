/**
 * POST /api/admin/orders/[orderId]/report/qa-approve
 *
 * QA-approves the generated report for this order.
 * Required role: operations_lead, admin, or owner.
 *
 * Body (optional):
 *   report_id  string  — UUID of the specific generated_reports row to approve.
 *                        Defaults to the latest row for the order.
 *   notes      string  — Optional QA notes.
 *
 * Effects:
 *   - generated_reports.report_status = 'qa_approved'
 *   - generated_reports.qa_approved_by, qa_approved_at set
 *   - orders.report_status = 'approved'
 *   - Audit log + order event
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";
import { applyQaDecision } from "@/lib/report/qa-approval";

export const dynamic = "force-dynamic";

const schema = z.object({
  report_id: z.string().uuid().optional(),
  notes:     z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    // QA approval is restricted to senior roles
    const result = await requireRole(["operations_lead", "ops_lead", "admin", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }
    const { report_id, notes } = parsed.data;

    const now = new Date().toISOString();

    const approval = await applyQaDecision({
      orderId: params.orderId,
      decision: "approved",
      actorId: actor.userId,
      notes,
      reportId: report_id,
    });

    const details = {
      qa_approved_by: actor.userId,
      report_id:      approval.report?.id ?? report_id ?? null,
      notes:          notes ?? null,
    };

    await Promise.all([
      writeOrderEvent({
        orderId:    params.orderId,
        eventType:  "report_qa_approved",
        actorId:    actor.userId,
        actorEmail: actor.email,
        details,
        isInternal: true,
      }),
      writeAuditLog({
        actorId:    actor.userId,
        actorEmail: actor.email,
        actorRole:  actor.role,
        action:     "order.report_qa_approved",
        resourceId: params.orderId,
        newValue:   details,
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err?.message === "Report not found" ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
