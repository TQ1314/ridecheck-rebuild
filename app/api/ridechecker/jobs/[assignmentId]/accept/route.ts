import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeOrderEvent } from "@/lib/rbac";
import { emitScoreEvent } from "@/lib/ridechecker/scorecard";
import { sendPreferred, sendDirect } from "@/lib/notifications/send-preferred";
import { hasSignedCurrentAgreement } from "@/lib/agreements/rccpa-v1-2026-06";
import {
  sellerTrustConfirmationHtml,
  sellerTrustConfirmationSms,
} from "@/lib/email/templates/seller-trust-confirmation";

const PAID_STATUSES = ["paid", "paid_manual_verified", "override_approved"] as const;

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name, email, agreement_status, current_agreement_version")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker", "ridechecker_active", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!hasSignedCurrentAgreement(profile as any)) {
      return NextResponse.json(
        {
          error: "You must sign the current RideCheck Contractor Agreement before accepting assignments.",
          agreement_required: true,
          redirect: "/ridechecker/agreement",
        },
        { status: 403 }
      );
    }

    const { data: assignment, error: fetchError } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .select("id, status, order_id, expires_at")
      .eq("id", params.assignmentId)
      .eq("ridechecker_id", session.user.id)
      .maybeSingle();

    if (fetchError || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const acceptableStatuses = ["awaiting_acceptance", "assigned"];
    if (!acceptableStatuses.includes(assignment.status)) {
      return NextResponse.json(
        { error: "Assignment cannot be accepted in its current status" },
        { status: 400 }
      );
    }

    // Check expiry
    if (assignment.expires_at) {
      const expiresAt = new Date(assignment.expires_at);
      if (expiresAt < new Date()) {
        // Mark as expired
        await supabaseAdmin
          .from("ridechecker_job_assignments")
          .update({ status: "expired" })
          .eq("id", assignment.id);

        return NextResponse.json(
          { error: "This assignment has expired. Please contact ops to be reassigned." },
          { status: 410 }
        );
      }
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .update({
        status: "accepted",
        accepted_at: now,
      })
      .eq("id", assignment.id);

    if (updateError) {
      console.error("[accept assignment error]", updateError);
      return NextResponse.json({ error: "Failed to accept assignment" }, { status: 500 });
    }

    // Update order assignment_status
    await supabaseAdmin
      .from("orders")
      .update({ assignment_status: "accepted", updated_at: now })
      .eq("id", assignment.order_id);

    // Write order event
    await writeOrderEvent({
      orderId: assignment.order_id,
      eventType: "ridechecker_accepted",
      actorId: session.user.id,
      actorEmail: profile.email ?? session.user.email ?? "",
      details: {
        assignment_id: assignment.id,
        ridechecker_name: profile.full_name ?? null,
      },
    }).catch(() => {});

    // Stage 1 score event — job accepted
    emitScoreEvent({
      ridecheckerId: session.user.id,
      assignmentId: assignment.id,
      orderId: assignment.order_id,
      eventType: "accepted_job",
    }).catch(() => {});

    // ── Seller Trust Confirmation (non-fatal) ────────────────────────────────
    // Guards: payment authorized + seller approved inspection + RC profile verified
    void (async () => {
      try {
        const { data: orderRaw } = await supabaseAdmin
          .from("orders")
          .select(
            "id, seller_phone, seller_email, seller_contact_status, payment_status, " +
            "payment_override_approved, vehicle_year, vehicle_make, vehicle_model, scheduled_date"
          )
          .eq("id", assignment.order_id)
          .maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const order = orderRaw as any;

        if (!order) return;

        const isPaid = PAID_STATUSES.includes(order.payment_status as any)
          || order.payment_override_approved;
        const sellerApproved = order.seller_contact_status === "accepted";
        const rcVerified = profile.role === "ridechecker_active";

        if (!isPaid || !sellerApproved || !rcVerified) return;

        // Fetch RC public profile fields
        const { data: rcProfileRaw } = await supabaseAdmin
          .from("profiles")
          .select("full_name, photo_url, completed_inspections, average_rating")
          .eq("id", session.user.id)
          .maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rcProfile = rcProfileRaw as any;

        const firstName = (rcProfile?.full_name || profile.full_name || "Your RideChecker")
          .split(" ")[0];

        let etaText: string | null = null;
        if (order.scheduled_date) {
          etaText = new Date(order.scheduled_date).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
        }

        const msgParams = {
          ridecheckerFirstName: firstName,
          ridecheckerPhotoUrl: (rcProfile as any)?.photo_url ?? null,
          ridecheckerRating: (rcProfile as any)?.average_rating ?? null,
          ridecheckerCompletedInspections: (rcProfile as any)?.completed_inspections ?? null,
          etaText,
          vehicleYear: order.vehicle_year,
          vehicleMake: order.vehicle_make,
          vehicleModel: order.vehicle_model,
        };

        const payload = {
          subject: "Your RideCheck Inspection is Confirmed",
          html: sellerTrustConfirmationHtml(msgParams),
          smsBody: sellerTrustConfirmationSms(msgParams),
        };

        const attemptRows: any[] = [];

        const smsStatusCallback = process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`
          : undefined;

        if (order.seller_phone) {
          const r = await sendDirect("sms", order.seller_phone, payload, { statusCallback: smsStatusCallback });
          attemptRows.push({
            order_id: assignment.order_id,
            attempt_number: 99,
            channel: "sms",
            destination: order.seller_phone,
            message_template_key: "seller_trust_confirmation",
            message_body: payload.smsBody,
            status: r.success ? "sent" : "failed",
            delivery_status: r.success ? "queued" : "failed",
            provider_message_id: r.sid ?? null,
            is_auto_notification: true,
            created_by: session.user.id,
          });
        }

        if (order.seller_email) {
          const r = await sendDirect("email", order.seller_email, payload);
          attemptRows.push({
            order_id: assignment.order_id,
            attempt_number: 99,
            channel: "email",
            destination: order.seller_email,
            message_template_key: "seller_trust_confirmation",
            message_body: `Subject: ${payload.subject}`,
            status: r.success ? "sent" : "failed",
            delivery_status: r.success ? "queued" : "failed",
            provider_message_id: r.messageId ?? null,
            is_auto_notification: true,
            created_by: session.user.id,
          });
        }

        if (attemptRows.length > 0) {
          await supabaseAdmin.from("seller_contact_attempts").insert(attemptRows);
        }

        await writeOrderEvent({
          orderId: assignment.order_id,
          eventType: "seller_trust_message_sent",
          actorId: session.user.id,
          actorEmail: profile.email ?? session.user.email ?? "",
          details: {
            ridechecker_first_name: firstName,
            channels: attemptRows.map((r) => r.channel),
          },
        }).catch(() => {});
      } catch (err) {
        console.error("[seller-trust-confirmation error]", err);
      }
    })();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[accept assignment error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
