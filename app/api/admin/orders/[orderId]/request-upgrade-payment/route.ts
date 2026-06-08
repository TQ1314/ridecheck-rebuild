import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia" as any,
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole([
      "operations", "operations_lead", "ops_lead", "admin", "owner", "ops",
    ]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    let body: { diff_cents: number; new_package: string } = { diff_cents: 0, new_package: "" };
    try { body = await req.json(); } catch { /* ignore */ }

    if (!body.diff_cents || body.diff_cents <= 0) {
      return NextResponse.json({ error: "diff_cents must be a positive integer" }, { status: 400 });
    }

    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_email, customer_email, vehicle_year, vehicle_make, vehicle_model, package, payment_status")
      .eq("id", params.orderId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if ((order as any).payment_status !== "paid") {
      return NextResponse.json(
        { error: "Upgrade payment only available after the original payment is confirmed." },
        { status: 400 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";
    const buyerEmail = (order as any).buyer_email || (order as any).customer_email;
    const vehicle = `${(order as any).vehicle_year} ${(order as any).vehicle_make} ${(order as any).vehicle_model}`.trim();
    const newPkg = body.new_package || "upgraded";
    const pkgLabel = newPkg.charAt(0).toUpperCase() + newPkg.slice(1);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: buyerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `RideCheck ${pkgLabel} Assessment — Package Upgrade`,
              description: `Upgrade to ${pkgLabel} package for ${vehicle}`,
            },
            unit_amount: Math.round(body.diff_cents),
          },
          quantity: 1,
        },
      ],
      metadata: {
        order_id:     params.orderId,
        session_type: "package_upgrade",
        new_package:  newPkg,
        customer_email: buyerEmail || "",
      },
      success_url: `${appUrl}/order/received?orderId=${params.orderId}&status=paid&upgrade=1`,
      cancel_url:  `${appUrl}/order/received?orderId=${params.orderId}`,
    });

    // Save the payment link to the order
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("orders")
      .update({
        payment_link_url:            session.url,
        stripe_checkout_session_id:  session.id,
        stripe_session_id:           session.id,
        payment_status:              "requested",
        updated_at:                  now,
      })
      .eq("id", params.orderId)
      .eq("payment_status", "paid"); // guard: only if already paid (this is a top-up)

    await Promise.all([
      writeOrderEvent({
        orderId:    params.orderId,
        eventType:  "upgrade_payment_requested",
        actorId:    actor.userId,
        actorEmail: actor.email,
        details: {
          diff_cents:  body.diff_cents,
          new_package: newPkg,
          session_id:  session.id,
        },
      }),
      writeAuditLog({
        actorId:    actor.userId,
        actorEmail: actor.email,
        actorRole:  actor.role,
        action:     "order.upgrade_payment_requested",
        resourceId: params.orderId,
        newValue: { diff_cents: body.diff_cents, new_package: newPkg },
      }),
    ]);

    return NextResponse.json({
      success:      true,
      session_url:  session.url,
      session_id:   session.id,
      diff_cents:   body.diff_cents,
    });
  } catch (err: any) {
    console.error("[Request Upgrade Payment] Error", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
