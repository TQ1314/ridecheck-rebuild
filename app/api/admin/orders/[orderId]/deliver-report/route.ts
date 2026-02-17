import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    // IMPORTANT: params.orderId is the UUID (orders.id)
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_id, report_status, report_storage_path, buyer_email, customer_email, customer_name, vehicle_year, vehicle_make, vehicle_model"
      )
      .eq("id", params.orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.report_status !== "approved") {
      return NextResponse.json(
        { error: "Report must be QA-approved before delivery" },
        { status: 400 }
      );
    }

    if (!order.report_storage_path) {
      return NextResponse.json({ error: "No report file found" }, { status: 400 });
    }

    const { data: signedData, error: signedErr } = await supabaseAdmin.storage
      .from("reports")
      .createSignedUrl(order.report_storage_path, 7 * 24 * 3600);

    if (signedErr) {
      return NextResponse.json({ error: "Failed to create signed URL" }, { status: 500 });
    }

    const reportUrl = signedData?.signedUrl;

    const buyerEmail = order.buyer_email || order.customer_email;

    if (buyerEmail) {
      try {
        const { sendEmail } = await import("@/lib/email/resend");
        await sendEmail({
          to: buyerEmail,
          subject: `Your RideCheck Intelligence Report is Ready - ${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Your Intelligence Report is Ready</h2>
              <p>Hi ${order.customer_name || "there"},</p>
              <p>Your report for <strong>${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}</strong> is ready.</p>
              <p>Order: <strong>${order.order_id || order.id}</strong></p>
              ${reportUrl ? `<p><a href="${reportUrl}">View Your Report</a></p><p style="color:#666;font-size:12px;">This link expires in 7 days.</p>` : ""}
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Failed to send delivery email:", emailErr);
      }
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        report_status: "delivered",
        report_delivered_at: now,
        updated_at: now,
      })
      .eq("id", order.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update delivery status" },
        { status: 500 }
      );
    }

    await Promise.all([
      writeOrderEvent({
        orderId: order.id, // UUID
        eventType: "report_delivered",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: { delivered_to: buyerEmail || null },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.report_delivered",
        resourceType: "order",
        resourceId: order.id, // UUID (THIS must match your GET route filter)
        newValue: { delivered_to: buyerEmail || null },
      }),
    ]);

    return NextResponse.json({ success: true, reportUrl });
  } catch (err: any) {
    console.error("Deliver report error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
