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

    let body: { diff_cents: number; new_package: string };
    try {
      const parsedBody = await req.json();
      if (!parsedBody || typeof parsedBody !== "object") {
        return NextResponse.json({ error: "Invalid upgrade payment request" }, { status: 400 });
      }
      body = parsedBody as { diff_cents: number; new_package: string };
    } catch {
      return NextResponse.json({ error: "Invalid upgrade payment request" }, { status: 400 });
    }

    if (!Number.isSafeInteger(body.diff_cents) || body.diff_cents <= 0) {
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

    // A package top-up is a separate payment. Do not reuse base-order payment
    // fields or mark the already-paid inspection as requested/unpaid. Keep the
    // top-up session and amount in the existing append-only order/audit events.
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
          session_url: session.url,
          base_payment_status: "paid",
        },
      }),
      writeAuditLog({
        actorId:    actor.userId,
        actorEmail: actor.email,
        actorRole:  actor.role,
        action:     "order.upgrade_payment_requested",
        resourceId: params.orderId,
        newValue: {
          diff_cents: body.diff_cents,
          new_package: newPkg,
          session_id: session.id,
          base_payment_status: "paid",
        },
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
