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

    if (report_id) {
      // Approve a specific row — validate order binding first
      const { data: genReport } = await supabaseAdmin
        .from("generated_reports")
        .select("id, order_id, report_status")
        .eq("id", report_id)
        .single();

      if (!genReport) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      if (genReport.order_id !== params.orderId) {
        // Security violation
        await writeAuditLog({
          actorId:    actor.userId,
          actorEmail: actor.email,
          actorRole:  actor.role,
          action:     "security.report_qa_order_mismatch",
          resourceId: params.orderId,
          newValue:   { attempted_report_id: report_id, report_order_id: genReport.order_id },
        });
        return NextResponse.json(
          { error: "Report does not belong to this order. QA approval blocked." },
          { status: 403 }
        );
      }

      const { error: updateErr } = await supabaseAdmin
        .from("generated_reports")
        .update({
          report_status:  "qa_approved",
          qa_approved_by: actor.userId,
          qa_approved_at: now,
          qa_notes:       notes ?? null,
          updated_at:     now,
        })
        .eq("id", report_id);

      if (updateErr) {
        return NextResponse.json({ error: "Failed to update generated report" }, { status: 500 });
      }
    } else {
      // No report_id — find and approve the latest qa_pending row for this order
      const { data: latestReport } = await supabaseAdmin
        .from("generated_reports")
        .select("id, report_status")
        .eq("order_id", params.orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestReport) {
        // No generated_reports row — this is a legacy order; just approve via orders table
        console.warn(`[qa-approve] No generated_reports for order ${params.orderId} — approving via orders table only`);
      } else {
        const { error: updateErr } = await supabaseAdmin
          .from("generated_reports")
          .update({
            report_status:  "qa_approved",
            qa_approved_by: actor.userId,
            qa_approved_at: now,
            qa_notes:       notes ?? null,
            updated_at:     now,
          })
          .eq("id", latestReport.id);

        if (updateErr) {
          return NextResponse.json({ error: "Failed to update generated report" }, { status: 500 });
        }
      }
    }

    // Always update orders.report_status = 'approved'
    const { error: orderUpdateErr } = await supabaseAdmin
      .from("orders")
      .update({
        report_status: "approved",
        updated_at:    now,
      })
      .eq("id", params.orderId);

    if (orderUpdateErr) {
      console.error("[qa-approve] order update error:", orderUpdateErr);
    }

    const details = {
      qa_approved_by: actor.userId,
      report_id:      report_id ?? null,
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
