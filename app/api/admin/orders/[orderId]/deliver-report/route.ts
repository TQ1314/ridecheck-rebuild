import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, order_id, report_status, report_storage_path, buyer_email, customer_name, vehicle_year, vehicle_make, vehicle_model")
      .eq("order_id", params.orderId)
      .maybeSingle();

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
      return NextResponse.json(
        { error: "No report file found" },
        { status: 400 }
      );
    }

    const { data: signedData } = await supabaseAdmin.storage
      .from("reports")
      .createSignedUrl(order.report_storage_path, 7 * 24 * 3600);

    const reportUrl = signedData?.signedUrl;

    if (order.buyer_email) {
      try {
        const { sendEmail } = await import("@/lib/email/resend");
        await sendEmail({
          to: order.buyer_email,
          subject: `Your RideCheck Intelligence Report is Ready - ${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Your Intelligence Report is Ready</h2>
              <p>Hi ${order.customer_name || "there"},</p>
              <p>Great news! Your vehicle assessment report for the <strong>${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}</strong> is now ready.</p>
              <p>Order: <strong>${order.order_id}</strong></p>
              ${reportUrl ? `<p><a href="${reportUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:white;text-decoration:none;border-radius:6px;">View Your Report</a></p><p style="color:#666;font-size:12px;">This link expires in 7 days.</p>` : ""}
              <p>Thank you for choosing RideCheck.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Failed to send delivery email:", emailErr);
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        report_status: "delivered",
        report_delivered_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update delivery status" }, { status: 500 });
    }

    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      event_type: "report_delivered",
      description: `Intelligence report delivered to ${order.buyer_email || "customer"}`,
      performed_by: actor.userId,
    });

    await writeAuditLog({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "report.delivered",
      resourceType: "order",
      resourceId: order.order_id,
      newValue: { delivered_to: order.buyer_email },
    });

    return NextResponse.json({ success: true, reportUrl });
  } catch (err: any) {
    console.error("Deliver report error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
