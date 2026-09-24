import { supabaseAdmin } from "@/lib/supabase/admin";

export type QaDecision = "approved" | "revision_needed";

/**
 * Canonical QA state transition. Both QA review and Ops report controls use
 * this function so the order and generated report never drift apart.
 *
 * Supabase transactions are not exposed by the client used by this app. The
 * compensating update keeps a failed order write from leaving a report
 * apparently approved.
 */
export async function applyQaDecision(input: {
  orderId: string;
  decision: QaDecision;
  actorId: string;
  notes?: string | null;
  reportId?: string | null;
}) {
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, order_id, qa_status, report_status")
    .or(`id.eq.${input.orderId},order_id.eq.${input.orderId}`)
    .maybeSingle();
  if (orderError || !order) throw new Error("Order not found");

  const { data: report, error: reportError } = await supabaseAdmin
    .from("generated_reports")
    .select("id, order_id, report_status")
    .eq(input.reportId ? "id" : "order_id", input.reportId ?? order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reportError) throw new Error("Failed to load generated report");
  if (input.reportId && !report) {
    throw new Error("Report not found");
  }
  if (input.reportId && report && report.order_id !== order.id) {
    throw new Error("Report does not belong to this order");
  }

  const now = new Date().toISOString();
  const reportStatus = input.decision === "approved" ? "qa_approved" : "revision_needed";
  const oldReport = report
    ? { report_status: report.report_status }
    : null;
  if (report) {
    const { error } = await supabaseAdmin.from("generated_reports").update({
      report_status: reportStatus,
      qa_approved_by: input.decision === "approved" ? input.actorId : null,
      qa_approved_at: input.decision === "approved" ? now : null,
      qa_notes: input.notes ?? null,
      updated_at: now,
    }).eq("id", report.id);
    if (error) throw new Error("Failed to update generated report");
  }

  const { error: updateError } = await supabaseAdmin.from("orders").update({
    qa_status: input.decision,
    report_status: input.decision === "approved" ? "approved" : "revision_needed",
    qa_reviewed_by: input.actorId,
    qa_reviewed_at: now,
    ...(input.notes !== undefined ? { qa_notes: input.notes } : {}),
    updated_at: now,
  }).eq("id", order.id);

  if (updateError) {
    if (report && oldReport) {
      await supabaseAdmin.from("generated_reports").update({
        report_status: oldReport.report_status,
        updated_at: new Date().toISOString(),
      }).eq("id", report.id);
    }
    throw new Error("Failed to update QA review");
  }
  return { order, report, now };
}