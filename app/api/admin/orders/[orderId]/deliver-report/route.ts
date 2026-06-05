import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { canProceedWithRideCheck, PAYMENT_GATE_ERRORS } from "@/lib/payment/payment-gate";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    // IMPORTANT: params.orderId is the UUID (orders.id)
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_id, report_status, report_storage_path, ops_report_url, buyer_email, customer_email, customer_name, vehicle_year, vehicle_make, vehicle_model, payment_status, payment_required, payment_override_approved"
      )
      .eq("id", params.orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Payment gate
    if (!canProceedWithRideCheck(order)) {
      return NextResponse.json({ error: PAYMENT_GATE_ERRORS.report_delivery }, { status: 402 });
    }

    // ── Risk Intelligence QC check ──────────────────────────────────────────
    // If a risk check record exists but is incomplete (score not yet saved),
    // block delivery. If no record exists at all, allow (backward compat) with warning.
    const { data: riskChk } = await supabaseAdmin
      .from("vehicle_risk_checks")
      .select("id, overall_risk_score, overall_risk_level")
      .eq("order_id", params.orderId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (riskChk && riskChk.overall_risk_score == null) {
      return NextResponse.json(
        {
          error:
            "Risk intelligence was started but did not complete. Re-run Risk Intelligence before delivering this report.",
        },
        { status: 400 }
      );
    }

    if (!riskChk) {
      console.warn(
        `[deliver-report] No risk intelligence found for order ${params.orderId} — proceeding without it.`
      );
    }

    const deliverableStatuses = ["approved", "generated", "report_ready"];
    if (!deliverableStatuses.includes(order.report_status ?? "") && !order.report_storage_path && !order.ops_report_url) {
      return NextResponse.json(
        { error: "No report available to deliver. Generate the report first." },
        { status: 400 }
      );
    }

    // Prefer storage path (AI-generated PDF); fall back to ops_report_url
    const hasStoragePath = !!order.report_storage_path;
    if (!hasStoragePath && !order.ops_report_url) {
      return NextResponse.json({ error: "No report file found" }, { status: 400 });
    }

    let reportUrl: string | null = null;

    if (order.report_storage_path) {
      const { data: signedData, error: signedErr } = await supabaseAdmin.storage
        .from("reports")
        .createSignedUrl(order.report_storage_path, 7 * 24 * 3600);
      if (signedErr) {
        console.error("Failed to create signed URL:", signedErr);
        // Non-fatal — fall back to ops_report_url if available
      } else {
        reportUrl = signedData?.signedUrl ?? null;
      }
    }

    // Fall back to manually-set report URL
    if (!reportUrl && order.ops_report_url) {
      reportUrl = order.ops_report_url;
    }

    if (!reportUrl) {
      return NextResponse.json({ error: "Could not generate a report link. Check the report file." }, { status: 500 });
    }

    const buyerEmail = order.buyer_email || order.customer_email;

    if (buyerEmail) {
      try {
        const { sendEmail } = await import("@/lib/email/resend");
        const vehicleLabel = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;
        const customerFirst = (order.customer_name || "there").split(" ")[0];
        await sendEmail({
          to: buyerEmail,
          subject: `Your RideCheck Intelligence Report is Ready — ${vehicleLabel}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <div style="text-align:center;margin-bottom:24px;">
                <h1 style="color:#22774F;margin:0;font-size:26px;">RideCheck</h1>
                <p style="color:#64748b;font-size:13px;margin:4px 0 0;">Pre-Car-Purchase Intelligence</p>
              </div>

              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
                <p style="font-size:18px;font-weight:700;color:#166534;margin:0 0 4px;">Your Intelligence Report is Ready</p>
                <p style="color:#15803d;margin:0;font-size:14px;">${vehicleLabel}</p>
              </div>

              <p style="color:#1e293b;font-size:15px;">Hi ${customerFirst},</p>
              <p style="color:#475569;line-height:1.6;">Your RideCheck intelligence report for the <strong>${vehicleLabel}</strong> has been reviewed, quality-checked, and is now ready for you to view.</p>

              <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f8fafc;border-radius:8px;">
                <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;width:40%;">Order</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;color:#1e293b;">${order.order_id || order.id}</td></tr>
                <tr><td style="padding:10px 16px;font-weight:600;color:#475569;">Vehicle</td><td style="padding:10px 16px;color:#1e293b;">${vehicleLabel}</td></tr>
              </table>

              ${reportUrl ? `
              <p style="text-align:center;margin:28px 0;">
                <a href="${reportUrl}" style="display:inline-block;background:#22774F;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">View My Report</a>
              </p>
              <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:8px;">This secure link expires in 7 days. Download or save your report before it expires.</p>
              ` : `<p style="color:#475569;">Your report is ready. Please log in to your account to access it.</p>`}

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px;" />
              <p style="color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
                RideCheck — Pre-Car-Purchase Intelligence<br/>
                Questions? Contact us at <a href="mailto:support@ridecheckauto.com" style="color:#22774F;">support@ridecheckauto.com</a>
              </p>
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
        resourceId: order.id,
        newValue: { delivered_to: buyerEmail || null },
      }),
    ]);

    return NextResponse.json({ success: true, reportUrl });
  } catch (err: any) {
    console.error("Deliver report error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
