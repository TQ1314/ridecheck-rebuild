import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { canProceedWithRideCheck, PAYMENT_GATE_ERRORS } from "@/lib/payment/payment-gate";
import { hasSignedCurrentAgreement } from "@/lib/agreements/rccpa-v1-2026-06";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ACCEPTANCE_TIMEOUT_MINUTES = 15;

const schema = z.object({
  ridechecker_id: z.string().uuid().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { ridechecker_id } = parsed.data;

    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_id, vehicle_year, vehicle_make, vehicle_model, assignment_status, current_offer, base_pay, boost_amount, payment_status, payment_required, payment_override_approved")
      .eq("id", params.orderId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Payment gate — only check when actually assigning (not unassigning)
    if (ridechecker_id && !canProceedWithRideCheck(order)) {
      return NextResponse.json({ error: PAYMENT_GATE_ERRORS.assignment }, { status: 402 });
    }

    // Enforce pay-before-assign rule
    // Primary source of truth: rc_compensation_offers (Compensation Panel)
    // Fallback: legacy orders.base_pay / orders.current_offer fields
    let offeredPayForNotification: number | null = null;
    if (ridechecker_id) {
      const { data: savedOffer } = await supabaseAdmin
        .from("rc_compensation_offers")
        .select("id, total_offer, pay_status")
        .eq("order_id", params.orderId)
        .eq("is_current", true)
        .in("pay_status", ["saved", "approved", "override_approved"])
        .maybeSingle();

      const compensationPay = (savedOffer as any)?.total_offer ?? 0;
      const legacyPay = (order.base_pay ?? 0) > 0
        ? order.base_pay!
        : (order.current_offer ?? 0) > 0
          ? order.current_offer!
          : 0;

      const hasPay = compensationPay > 0 || legacyPay > 0;
      if (!hasPay) {
        return NextResponse.json(
          { error: "Set and save a RideChecker compensation offer before assigning." },
          { status: 400 }
        );
      }

      // Use the most accurate pay figure for notifications
      offeredPayForNotification = compensationPay > 0 ? compensationPay : legacyPay;
    }

    let rcName: string | null = null;

    if (ridechecker_id) {
      const { data: rc, error: rcErr } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, role, agreement_status, current_agreement_version")
        .eq("id", ridechecker_id)
        .single();

      if (rcErr || !rc) {
        return NextResponse.json({ error: "RideChecker not found" }, { status: 404 });
      }
      if (!["ridechecker", "ridechecker_active", "owner", "developer"].includes(rc.role)) {
        return NextResponse.json({ error: "User is not a RideChecker" }, { status: 400 });
      }
      if (!hasSignedCurrentAgreement(rc as any)) {
        return NextResponse.json(
          { error: "This RideChecker has not signed the current contractor agreement. They must sign before receiving assignments." },
          { status: 400 }
        );
      }
      rcName = rc.full_name;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + ACCEPTANCE_TIMEOUT_MINUTES * 60 * 1000).toISOString();

    const newOrderStatus = ridechecker_id ? "awaiting_acceptance" : "unassigned";

    // Cancel any existing open assignments for this order
    // Note: ridechecker_job_assignments has no updated_at column — do not include it
    if (ridechecker_id) {
      const { error: cancelErr } = await supabaseAdmin
        .from("ridechecker_job_assignments")
        .update({ status: "cancelled" })
        .eq("order_id", params.orderId)
        .in("status", ["awaiting_acceptance", "assigned"]);
      if (cancelErr) {
        console.error("[ridechecker-assign cancel error]", cancelErr.message, cancelErr.code);
      }
    }

    // Update order
    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        assigned_ridechecker_id: ridechecker_id,
        assignment_status: newOrderStatus,
        updated_at: nowIso,
      })
      .eq("id", params.orderId);

    if (updateErr) {
      console.error("[ridechecker-assign update error]", updateErr.message, updateErr.code, updateErr.details);
      return NextResponse.json({ error: `Failed to update assignment: ${updateErr.message}` }, { status: 500 });
    }

    let assignmentId: string | null = null;

    // Create new assignment row with expires_at when assigning
    if (ridechecker_id) {
      const { data: newAssignment, error: insertErr } = await supabaseAdmin
        .from("ridechecker_job_assignments")
        .insert({
          order_id: params.orderId,
          ridechecker_id,
          status: "awaiting_acceptance",
          expires_at: expiresAt,
          created_at: nowIso,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("[ridechecker-assign insert error]", insertErr);
        // Roll back the order update so ops and RC stay in sync
        await supabaseAdmin
          .from("orders")
          .update({ assigned_ridechecker_id: null, assignment_status: "unassigned", updated_at: nowIso })
          .eq("id", params.orderId);
        return NextResponse.json(
          { error: `Failed to create job assignment record: ${insertErr.message}` },
          { status: 500 }
        );
      } else {
        assignmentId = newAssignment?.id ?? null;
      }

      // Expire any open broadcasts
      await supabaseAdmin
        .from("job_broadcasts")
        .update({ status: "expired", updated_at: nowIso })
        .eq("order_id", params.orderId)
        .eq("status", "sent");
    }

    // Notify the RideChecker via SMS + email when assigned
    if (ridechecker_id && assignmentId) {
      try {
        const { data: rc } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, phone")
          .eq("id", ridechecker_id)
          .maybeSingle();

        if (rc) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";
          const vehicleLabel = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;
          const pay = offeredPayForNotification ?? order.current_offer ?? order.base_pay ?? null;
          const firstName = (rc.full_name || "there").split(" ")[0];
          const jobUrl = `${appUrl}/ridechecker/dashboard`;

          const smsBody = `RideCheck: Hi ${firstName}, a new job has been assigned to you${pay ? ` ($${pay})` : ""} — ${vehicleLabel}. You have 15 minutes to accept. Check your dashboard: ${jobUrl}`;

          const { ridecheckerJobOfferHtml } = await import(
            "@/lib/email/templates/ridecheckerJobOffer"
          );
          const emailHtml = ridecheckerJobOfferHtml({
            firstName,
            offeredPay:   pay ?? 0,
            vehicleYear:  order.vehicle_year  ?? null,
            vehicleMake:  order.vehicle_make  ?? null,
            vehicleModel: order.vehicle_model ?? null,
            orderId:      order.order_id      ?? null,
            dashboardUrl: jobUrl,
          });

          const notifs: Promise<any>[] = [];
          if (rc.phone) {
            const { sendSMS } = await import("@/lib/notifications/sms");
            notifs.push(sendSMS({ to: rc.phone, body: smsBody }));
          }
          if (rc.email) {
            const { sendEmail } = await import("@/lib/notifications/email");
            notifs.push(sendEmail({
              to: rc.email,
              subject: `New RideCheck Job — Action Required: ${vehicleLabel}`,
              html: emailHtml,
            }));
          }
          await Promise.allSettled(notifs);
        }
      } catch (notifErr) {
        console.error("[ridechecker-assign notify error]", notifErr);
      }
    }

    await Promise.allSettled([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: ridechecker_id ? "ridechecker_assigned" : "ridechecker_unassigned",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: {
          ridechecker_id: ridechecker_id ?? null,
          ridechecker_name: rcName,
          assignment_id: assignmentId,
          expires_at: ridechecker_id ? expiresAt : null,
        },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: ridechecker_id ? "order.ridechecker_assigned" : "order.ridechecker_unassigned",
        resourceId: params.orderId,
        newValue: {
          ridechecker_id: ridechecker_id ?? null,
          assignment_status: newOrderStatus,
          expires_at: ridechecker_id ? expiresAt : null,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      assignment_status: newOrderStatus,
      assignment_id: assignmentId,
      expires_at: ridechecker_id ? expiresAt : null,
      timeout_minutes: ACCEPTANCE_TIMEOUT_MINUTES,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
