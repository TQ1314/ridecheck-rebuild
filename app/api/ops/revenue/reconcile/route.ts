import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["admin", "owner", "operations_lead", "ops_lead"];
const MAX_STRIPE_LOOKUPS = 60;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia" as any,
});

interface Mismatch {
  order_id:         string;
  vehicle:          string;
  type:             "ridecheck_paid_stripe_not_confirmed" | "stripe_confirmed_not_marked_paid" | "amount_mismatch";
  ridecheck_amount: number;
  stripe_amount:    number | null;
  stripe_status:    string | null;
  message:          string;
}

interface Unverifiable {
  order_id:         string;
  vehicle:          string;
  reason:           "no_stripe_id" | "stripe_fetch_failed";
  ridecheck_amount: number;
}

export async function POST(req: NextRequest) {
  try {
    const result = await requireRole(ALLOWED_ROLES);
    if (!isAuthorized(result)) return result.error;

    let body: { from?: string; to?: string; package?: string } = {};
    try { body = await req.json(); } catch { /* ok */ }

    const now      = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const fromStr  = body.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const toStr    = body.to   || todayStr;

    let query = supabaseAdmin
      .from("orders")
      .select(
        "id, vehicle_year, vehicle_make, vehicle_model, package, " +
        "payment_status, final_price, base_price, " +
        "payment_intent_id, stripe_payment_intent_id, stripe_checkout_session_id, stripe_session_id"
      )
      .gte("created_at", fromStr + "T00:00:00.000Z")
      .lte("created_at", toStr   + "T23:59:59.999Z")
      .in("payment_status", ["paid", "paid_manual_verified"]);

    if (body.package && body.package !== "all") {
      query = query.eq("package", body.package);
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    const rows = (orders ?? []) as any[];
    const price = (o: any) => Number(o.final_price ?? o.base_price ?? 0);
    const vehicle = (o: any) =>
      [o.vehicle_year, o.vehicle_make, o.vehicle_model].filter(Boolean).join(" ") || "Unknown Vehicle";

    const mismatches:    Mismatch[]    = [];
    const unverifiable:  Unverifiable[] = [];

    let stripeGrossCents  = 0;
    let stripeFeesCents   = 0;
    let ordersChecked     = 0;
    let ordersWithStripeId = 0;

    // Separate orders into those with / without Stripe IDs
    const withStripeId    = rows.filter(
      (o) => o.stripe_payment_intent_id || o.payment_intent_id ||
             o.stripe_checkout_session_id || o.stripe_session_id
    ).slice(0, MAX_STRIPE_LOOKUPS);
    const withoutStripeId = rows.filter(
      (o) => !o.stripe_payment_intent_id && !o.payment_intent_id &&
             !o.stripe_checkout_session_id && !o.stripe_session_id
    );

    ordersWithStripeId = withStripeId.length;

    // Orders without any Stripe ID → all unverifiable
    for (const o of withoutStripeId) {
      unverifiable.push({
        order_id:         o.id,
        vehicle:          vehicle(o),
        reason:           "no_stripe_id",
        ridecheck_amount: price(o),
      });
    }

    // Lookup each Stripe record
    const lookupResults = await Promise.allSettled(
      withStripeId.map(async (o) => {
        const piId      = o.stripe_payment_intent_id || o.payment_intent_id;
        const sessionId = o.stripe_checkout_session_id || o.stripe_session_id;

        let stripeAmountCents: number | null  = null;
        let stripeStatus:       string | null = null;
        let feeCents:           number        = 0;

        if (piId && piId.startsWith("pi_")) {
          const pi = await stripe.paymentIntents.retrieve(piId, {
            expand: ["charges.data.balance_transaction"],
          } as any);
          stripeStatus      = pi.status;
          stripeAmountCents = pi.amount; // cents
          const charge      = (pi as any).charges?.data?.[0];
          const bt          = charge?.balance_transaction;
          if (bt && typeof bt === "object") feeCents = (bt as any).fee ?? 0;
        } else if (sessionId && sessionId.startsWith("cs_")) {
          const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ["payment_intent.charges.data.balance_transaction"],
          } as any);
          const pi = (session as any).payment_intent;
          if (pi && typeof pi === "object") {
            stripeStatus      = pi.status;
            stripeAmountCents = pi.amount;
            const charge      = pi.charges?.data?.[0];
            const bt          = charge?.balance_transaction;
            if (bt && typeof bt === "object") feeCents = bt.fee ?? 0;
          } else {
            stripeAmountCents = session.amount_total ?? null;
            stripeStatus      = session.payment_status;
          }
        }

        return { o, stripeAmountCents, stripeStatus, feeCents };
      })
    );

    ordersChecked = lookupResults.length;

    for (const settled of lookupResults) {
      if (settled.status === "rejected") {
        // Can't determine which order failed cleanly — skip
        continue;
      }
      const { o, stripeAmountCents, stripeStatus, feeCents } = settled.value;
      const rcAmountCents = Math.round(price(o) * 100);

      if (stripeAmountCents === null) {
        // Fetch failed or no useful data
        unverifiable.push({
          order_id:         o.id,
          vehicle:          vehicle(o),
          reason:           "stripe_fetch_failed",
          ridecheck_amount: price(o),
        });
        continue;
      }

      // Accumulate Stripe totals (only succeeded)
      if (stripeStatus === "succeeded" || stripeStatus === "paid") {
        stripeGrossCents += stripeAmountCents;
        stripeFeesCents  += feeCents;
      }

      // ── Warning: RideCheck says paid, Stripe does not confirm ──────────
      if (
        o.payment_status === "paid" &&
        stripeStatus !== "succeeded" && stripeStatus !== "paid"
      ) {
        mismatches.push({
          order_id:         o.id,
          vehicle:          vehicle(o),
          type:             "ridecheck_paid_stripe_not_confirmed",
          ridecheck_amount: price(o),
          stripe_amount:    stripeAmountCents / 100,
          stripe_status:    stripeStatus,
          message:          `RideCheck shows paid but Stripe status is "${stripeStatus ?? "unknown"}"`,
        });
        continue;
      }

      // ── Warning: Stripe confirmed, RideCheck not marked paid ───────────
      if (
        (stripeStatus === "succeeded" || stripeStatus === "paid") &&
        o.payment_status !== "paid" && o.payment_status !== "paid_manual_verified"
      ) {
        mismatches.push({
          order_id:         o.id,
          vehicle:          vehicle(o),
          type:             "stripe_confirmed_not_marked_paid",
          ridecheck_amount: price(o),
          stripe_amount:    stripeAmountCents / 100,
          stripe_status:    stripeStatus,
          message:          `Stripe shows succeeded but RideCheck payment_status is "${o.payment_status}"`,
        });
        continue;
      }

      // ── Warning: Amount mismatch (> $1 tolerance) ──────────────────────
      if (Math.abs(rcAmountCents - stripeAmountCents) > 100) {
        mismatches.push({
          order_id:         o.id,
          vehicle:          vehicle(o),
          type:             "amount_mismatch",
          ridecheck_amount: price(o),
          stripe_amount:    stripeAmountCents / 100,
          stripe_status:    stripeStatus,
          message:          `Amount mismatch: RideCheck $${price(o).toFixed(2)} vs Stripe $${(stripeAmountCents / 100).toFixed(2)}`,
        });
      }
    }

    const rideCheckGross = rows.reduce((s, o) => s + price(o), 0);
    const stripeGross    = stripeGrossCents / 100;
    const stripeFees     = stripeFeesCents  / 100;
    const stripeNet      = stripeGross - stripeFees;
    const difference     = rideCheckGross - stripeGross;

    return NextResponse.json({
      period:              { from: fromStr, to: toStr },
      ridecheck_gross:     rideCheckGross,
      stripe_gross:        stripeGross,
      difference:          difference,
      stripe_fees:         stripeFees,
      stripe_net:          stripeNet,
      orders_in_period:    rows.length,
      orders_with_stripe_id: ordersWithStripeId,
      orders_checked:      ordersChecked,
      mismatches,
      unverifiable,
      reconciled_at:       new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[ops/revenue/reconcile]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
