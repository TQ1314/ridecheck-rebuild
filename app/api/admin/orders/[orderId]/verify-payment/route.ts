import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    // Strictly owner and operations_lead only — no admin or ops
    const result = await requireRole(["owner", "operations_lead"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const {
      stripe_reference,   // payment intent ID or checkout session ID
      payer_email,        // email of payer
      amount,             // dollar amount verified
      payment_date,       // ISO timestamp of payment
      note,               // required evidence note
      evidence_url,       // optional screenshot URL
    } = body;

    // Validate required fields
    const missing: string[] = [];
    if (!stripe_reference?.trim()) missing.push("stripe_reference");
    if (!payer_email?.trim()) missing.push("payer_email");
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) missing.push("amount");
    if (!payment_date?.trim()) missing.push("payment_date");
    if (!note?.trim()) missing.push("note");

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch the order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status, payment_intent_id, stripe_session_id, payment_verified_by")
      .eq("id", params.orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // If already manually verified, prevent double-verification
    if (order.payment_status === "paid_manual_verified") {
      return NextResponse.json(
        { error: "Order has already been manually verified. Contact owner to override." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const parsedAmount = parseFloat(Number(amount).toFixed(2));

    // Update the order with manual verification data.
    // We do NOT touch payment_intent_id or stripe_session_id —
    // those are Stripe-webhook-managed fields and must not be overwritten.
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "paid_manual_verified",
        paid_at: payment_date,
        status: "payment_received",
        ops_status: "payment_received",
        // Manual verification columns (migration 031)
        payment_verification_note: note.trim(),
        payment_verified_by: actor.userId,
        payment_stripe_reference: stripe_reference.trim(),
        payment_evidence_url: evidence_url?.trim() || null,
        payment_verified_at: now,
        payment_amount_verified: parsedAmount,
        payment_payer_email: payer_email.trim().toLowerCase(),
        updated_at: now,
      })
      .eq("id", params.orderId);

    if (updateError) {
      console.error("[Verify Payment] DB update failed", { orderId: params.orderId, error: updateError });
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    console.log("[Verify Payment] Order manually verified", {
      orderId: params.orderId,
      verifiedBy: actor.email,
      stripeReference: stripe_reference,
      amount: parsedAmount,
    });

    // Write timeline event with full evidence trail
    await Promise.all([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "payment_manually_verified",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: {
          verified_by: actor.email,
          verified_by_id: actor.userId,
          stripe_reference: stripe_reference.trim(),
          payer_email: payer_email.trim().toLowerCase(),
          amount: parsedAmount,
          payment_date,
          note: note.trim(),
          evidence_url: evidence_url?.trim() || null,
        },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.payment_manually_verified",
        resourceId: params.orderId,
        oldValue: {
          payment_status: order.payment_status,
          payment_intent_id: order.payment_intent_id,
          stripe_session_id: order.stripe_session_id,
        },
        newValue: {
          payment_status: "paid_manual_verified",
          payment_stripe_reference: stripe_reference.trim(),
          payment_amount_verified: parsedAmount,
          payment_verified_by: actor.userId,
          payment_verified_at: now,
        },
      }),
      supabaseAdmin.from("activity_log").insert({
        order_id: params.orderId,
        action: "payment_manually_verified",
        details: {
          verified_by: actor.email,
          stripe_reference: stripe_reference.trim(),
          amount: parsedAmount,
          evidence_url: evidence_url?.trim() || null,
          note: note.trim(),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Payment manually verified and order updated.",
      verified_by: actor.email,
      verified_at: now,
    });
  } catch (err: any) {
    console.error("[Verify Payment Error]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
