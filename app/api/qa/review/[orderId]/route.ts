import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { createEarningForOrder } from "@/lib/utils/earnings-trigger";
import { z } from "zod";
import { applyQaDecision } from "@/lib/report/qa-approval";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["qa", "owner"]);
    if (!isAuthorized(result)) return result.error;

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("order_id", params.orderId)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let reportUrl = null;
    if (order.report_storage_path) {
      const { data: signedData } = await supabaseAdmin.storage
        .from("reports")
        .createSignedUrl(order.report_storage_path, 3600);
      reportUrl = signedData?.signedUrl || null;
    }

    const { data: events } = await supabaseAdmin
      .from("order_events")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(30);

    return NextResponse.json({
      order,
      reportUrl,
      events: events || [],
    });
  } catch (err: any) {
    const status = err?.message === "Report not found" ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

const qaReviewSchema = z.object({
  qa_status: z.enum(["approved", "revision_needed"]),
  qa_notes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["qa", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = qaReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { order } = await applyQaDecision({
      orderId: params.orderId,
      decision: parsed.data.qa_status,
      actorId: actor.userId,
      notes: parsed.data.qa_notes,
    });

    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      event_type: "qa_review",
      description: `QA ${parsed.data.qa_status === "approved" ? "approved" : "requested revision"}: ${parsed.data.qa_notes || "No notes"}`,
      performed_by: actor.userId,
      metadata: { qa_status: parsed.data.qa_status, canonical: true },
    });

    await writeAuditLog({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: `qa.${parsed.data.qa_status}`,
      resourceId: order.order_id,
      oldValue: { qa_status: order.qa_status, report_status: order.report_status },
      newValue: { qa_status: parsed.data.qa_status, report_status: parsed.data.qa_status === "approved" ? "approved" : "revision_needed" },
    });

    if (parsed.data.qa_status === "approved") {
      await createEarningForOrder(order.order_id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
