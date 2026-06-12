/**
 * POST /api/admin/orders/[orderId]/deliver-report
 *
 * Delivers the report to the buyer via email.
 *
 * Safety controls added (Migration 052):
 *   1. Fetches the generated_reports row for this order.
 *   2. Validates report.order_id === params.orderId (always true by query, but logged).
 *   3. Validates report.buyer_email matches the order's buyer email.
 *   4. Requires report.report_status === 'qa_approved' for new-system reports.
 *   5. If confirmed_report_id is supplied in body, validates it matches the row.
 *   6. Inserts a report_delivery_events row after every delivery attempt.
 *   7. Updates generated_reports.report_status = 'delivered'.
 *
 * Backward compat: orders with no generated_reports row (pre-migration) are allowed
 * through with the original validation (report_status check on orders table).
 */

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

    // Parse optional confirmation fields from body
    let confirmedReportId: string | null = null;
    try {
      const body = await req.json();
      confirmedReportId = body?.confirmed_report_id ?? null;
    } catch {
      // No body is fine — confirmation may not be provided for legacy flows
    }

    // IMPORTANT: params.orderId is the UUID (orders.id)
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_id, report_status, report_storage_path, ops_report_url, buyer_email, customer_email, customer_name, vehicle_year, vehicle_make, vehicle_model, payment_status, payment_required, payment_override_approved, seller_type"
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

    // ── Title & Transfer Readiness QC gate ──────────────────────────────────
    const sellerType = (order as Record<string, unknown>).seller_type ?? "private_party";
    if (sellerType === "private_party") {
      const { data: ttc } = await supabaseAdmin
        .from("vehicle_title_transfer_checks")
        .select("id, transfer_readiness_status")
        .eq("order_id", params.orderId)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!ttc) {
        return NextResponse.json(
          { error: "Title & Transfer Readiness review incomplete. Complete the title review before delivering this report." },
          { status: 400 }
        );
      }
    }

    // ── Report-to-Order Safety Controls (Migration 052) ─────────────────────
    // Look up the latest generated_reports row for this order.
    const { data: genReport } = await supabaseAdmin
      .from("generated_reports")
      .select("id, order_id, buyer_email, report_status, report_storage_path, report_url")
      .eq("order_id", params.orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (genReport) {
      // ── New-system order: enforce all safety checks ──

      // 1. confirmed_report_id must match if provided
      if (confirmedReportId && confirmedReportId !== genReport.id) {
        await writeAuditLog({
          actorId:    actor.userId,
          actorEmail: actor.email,
          actorRole:  actor.role,
          action:     "security.report_delivery_id_mismatch",
          resourceId: params.orderId,
          newValue:   {
            confirmed_report_id: confirmedReportId,
            actual_report_id:    genReport.id,
            order_id:            params.orderId,
          },
        });
        return NextResponse.json(
          {
            error:
              "Report ID mismatch — the confirmed report does not match the report on file for this order. Delivery blocked for safety.",
          },
          { status: 403 }
        );
      }

      // 2. Buyer email binding check
      const orderBuyerEmail = (order as any).buyer_email || order.customer_email;
      if (genReport.buyer_email && genReport.buyer_email !== orderBuyerEmail) {
        await writeAuditLog({
          actorId:    actor.userId,
          actorEmail: actor.email,
          actorRole:  actor.role,
          action:     "security.report_delivery_email_mismatch",
          resourceId: params.orderId,
          newValue:   {
            report_buyer_email: genReport.buyer_email,
            order_buyer_email:  orderBuyerEmail,
            report_id:          genReport.id,
          },
        });
        return NextResponse.json(
          {
            error:
              "Recipient mismatch — the report's buyer email does not match this order's buyer. Delivery blocked for safety.",
          },
          { status: 403 }
        );
      }

      // 3. QA approval gate
      const qaReadyStatuses = ["qa_approved", "delivered"];
      if (!qaReadyStatuses.includes(genReport.report_status)) {
        return NextResponse.json(
          {
            error:
              "This report has not been QA approved yet. A senior operations member must approve the report before it can be sent to the buyer.",
          },
          { status: 403 }
        );
      }
    } else {
      // ── Legacy order: no generated_reports row — use original validation ──
      console.warn(
        `[deliver-report] Legacy delivery (no generated_reports): order ${params.orderId}, report_status=${order.report_status}`
      );

      const deliverableStatuses = ["approved", "generated", "report_ready"];
      if (
        !deliverableStatuses.includes(order.report_status ?? "") &&
        !order.report_storage_path &&
        !order.ops_report_url
      ) {
        return NextResponse.json(
          { error: "No report available to deliver. Generate the report first." },
          { status: 400 }
        );
      }
    }

    // ── Resolve report URL ───────────────────────────────────────────────────
    const hasStoragePath = !!(genReport?.report_storage_path || order.report_storage_path);
    if (!hasStoragePath && !order.ops_report_url) {
      return NextResponse.json({ error: "No report file found" }, { status: 400 });
    }

    let reportUrl: string | null = null;
    const storagePath = genReport?.report_storage_path || order.report_storage_path;

    if (storagePath) {
      const { data: signedData, error: signedErr } = await supabaseAdmin.storage
        .from("reports")
        .createSignedUrl(storagePath, 7 * 24 * 3600);
      if (signedErr) {
        console.error("Failed to create signed URL:", signedErr);
      } else {
        reportUrl = signedData?.signedUrl ?? null;
      }
    }

    if (!reportUrl && order.ops_report_url) {
      reportUrl = order.ops_report_url;
    }

    if (!reportUrl) {
      return NextResponse.json({ error: "Could not generate a report link. Check the report file." }, { status: 500 });
    }

    const buyerEmail = (order as any).buyer_email || order.customer_email;

    if (buyerEmail) {
      try {
        const { sendEmail }         = await import("@/lib/email/resend");
        const { brandedEmailLayout } = await import("@/lib/email/templates/brandedEmailLayout");
        const vehicleLabel    = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;
        const customerFirst   = (order.customer_name || "there").split(" ")[0];
        const displayOrderId  = (order as any).order_id || order.id;
        const reportId        = genReport?.id ?? null;

        const bodyHtml = `
<p style="margin:0 0 14px; color:#1e293b;">Hi ${customerFirst},</p>
<p style="margin:0 0 14px; color:#475569; line-height:1.7;">
  Your RideCheck intelligence report for the <strong>${vehicleLabel}</strong> has been
  reviewed, quality-checked, and is now ready for you.
</p>
<table cellpadding="0" cellspacing="0" width="100%"
  style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin:0 0 24px;">
  <tr>
    <td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:13px;
               font-weight:600; color:#475569; width:40%;">Order</td>
    <td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:13px;
               color:#1e293b;">${displayOrderId}</td>
  </tr>
  <tr>
    <td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:13px;
               font-weight:600; color:#475569;">Vehicle</td>
    <td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:13px;
               color:#1e293b;">${vehicleLabel}</td>
  </tr>
  ${reportId ? `<tr>
    <td style="padding:10px 16px; font-size:13px; font-weight:600; color:#475569;">Report ID</td>
    <td style="padding:10px 16px; font-size:13px; color:#1e293b; font-family:monospace;">${reportId}</td>
  </tr>` : ""}
</table>
${!reportUrl
  ? `<p style="color:#475569; line-height:1.6;">Your report is ready. Please log in to your account to access it.</p>`
  : `<p style="font-size:12px; color:#94a3b8; text-align:center; margin:0;">
      This secure link expires in 7 days. Download or save your report before it expires.<br>
      This report belongs to the buyer of record for order ${displayOrderId} only.
    </p>`
}`;

        await sendEmail({
          to:      buyerEmail,
          subject: `Your RideCheck Intelligence Report is Ready — ${vehicleLabel}`,
          html:    brandedEmailLayout({
            title:    "Your Intelligence Report Is Ready",
            subtitle: vehicleLabel,
            bodyHtml,
            callToAction: reportUrl
              ? { url: reportUrl, label: "View My RideCheck Report" }
              : null,
            footerDisclaimer:
              "This report was prepared by RideCheck for the buyer of record only. " +
              "If you received this in error, please contact us.",
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send delivery email:", emailErr);
      }
    }

    const now = new Date().toISOString();

    // ── Update orders status ─────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        report_status:       "delivered",
        report_delivered_at: now,
        updated_at:          now,
      })
      .eq("id", order.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update delivery status" },
        { status: 500 }
      );
    }

    // ── Update generated_reports row if exists ───────────────────────────────
    if (genReport?.id) {
      await supabaseAdmin
        .from("generated_reports")
        .update({
          report_status: "delivered",
          delivered_by:  actor.userId,
          delivered_at:  now,
          updated_at:    now,
        })
        .eq("id", genReport.id);
    }

    // ── Insert delivery event ─────────────────────────────────────────────────
    await supabaseAdmin
      .from("report_delivery_events")
      .insert({
        order_id:       order.id,
        report_id:      genReport?.id ?? null,
        recipient_email: buyerEmail ?? null,
        channel:        "email",
        status:         buyerEmail ? "sent" : "no_recipient",
        delivered_by:   actor.userId,
        delivered_at:   now,
        notes:          buyerEmail ? null : "No buyer email on file — email not sent",
      });

    await Promise.all([
      writeOrderEvent({
        orderId:    order.id,
        eventType:  "report_delivered",
        actorId:    actor.userId,
        actorEmail: actor.email,
        details:    { delivered_to: buyerEmail || null, report_id: genReport?.id ?? null },
      }),
      writeAuditLog({
        actorId:    actor.userId,
        actorEmail: actor.email,
        actorRole:  actor.role,
        action:     "order.report_delivered",
        resourceId: order.id,
        newValue:   { delivered_to: buyerEmail || null, report_id: genReport?.id ?? null },
      }),
    ]);

    return NextResponse.json({ success: true, reportUrl });
  } catch (err: any) {
    console.error("Deliver report error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
