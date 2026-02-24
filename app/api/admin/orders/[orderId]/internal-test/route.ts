import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Internal test flow is not available in production" },
        { status: 403 },
      );
    }

    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, order_id, payment_status, is_internal_test, vehicle_year, vehicle_make, vehicle_model, package, booking_type, payment_link_token, tracking_token, customer_email, buyer_email, customer_phone, buyer_phone")
      .eq("id", params.orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.payment_status === "paid" || order.payment_status === "paid_test") {
      return NextResponse.json({ error: "Order already paid" }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const testRunId = `test_${randomUUID().slice(0, 8)}`;
    const token = order.payment_link_token || randomUUID();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const vehicleLabel = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "RideCheck Internal Test",
              description: `Test: ${vehicleLabel}`,
            },
            unit_amount: 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        order_id: params.orderId,
        is_internal_test: "true",
        test_run_id: testRunId,
        payment_link_token: token,
      },
      success_url: `${appUrl}/order/received?orderId=${params.orderId}&status=paid`,
      cancel_url: `${appUrl}/admin/orders/${params.orderId}`,
    });

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("orders")
      .update({
        is_internal_test: true,
        test_run_id: testRunId,
        payment_link_token: token,
        stripe_session_id: session.id,
        payment_status: "pending",
        updated_at: now,
      })
      .eq("id", params.orderId);

    await Promise.all([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "internal_test_started",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: { test_run_id: testRunId, amount_cents: 100 },
        isInternal: true,
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.internal_test_started",
        resourceId: params.orderId,
        newValue: { test_run_id: testRunId, stripe_session_id: session.id },
      }),
    ]);

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      testRunId,
    });
  } catch (err: any) {
    console.error("[Internal Test Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
