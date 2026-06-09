import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import Stripe from "stripe";

const ALLOWED_ROLES = new Set(["admin", "owner", "operations_lead", "ops_lead"]);
const STRIPE_LOOKUP_CAP = 100; // max per export call to avoid timeout
const AMOUNT_TOLERANCE  = 1.00; // dollars

// ── CSV helpers ────────────────────────────────────────────────────────────────

function csvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

// ── GET /api/ops/revenue/export ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const supabase = createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !ALLOWED_ROLES.has(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Params ────────────────────────────────────────────────────────────────
    const { searchParams } = req.nextUrl;
    const from = searchParams.get("from");
    const to   = searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json({ error: "from and to are required" }, { status: 400 });
    }

    const pkg  = searchParams.get("package");
    const pmnt = searchParams.get("payment_status");
    const ops  = searchParams.get("ops_status");

    // ── Fetch orders ──────────────────────────────────────────────────────────
    let query = supabase
      .from("orders")
      .select([
        "id",
        "order_number",
        "created_at",
        "customer_name",
        "package",
        "base_price",
        "final_price",
        "payment_status",
        "ops_status",
        "report_status",
        "stripe_checkout_session_id",
        "stripe_session_id",
        "stripe_payment_intent_id",
        "payment_intent_id",
        "vehicle_year",
        "vehicle_make",
        "vehicle_model",
      ].join(", "))
      .gte("created_at", from + "T00:00:00.000Z")
      .lte("created_at", to   + "T23:59:59.999Z")
      .order("created_at", { ascending: false });

    if (pkg  && pkg  !== "all") query = query.eq("package",        pkg);
    if (pmnt && pmnt !== "all") query = query.eq("payment_status", pmnt);
    if (ops  && ops  !== "all") query = query.eq("ops_status",     ops);

    const { data: orders, error } = await query;
    if (error) throw error;

    const rows = (orders ?? []) as any[];

    // ── Stripe lookups for paid orders ────────────────────────────────────────
    type StripeResult = {
      gross:             number | null;
      fees:              number | null;
      net:               number | null;
      status:            string | null;
      recon_status:      string;
      mismatch_reason:   string;
    };

    const stripeResultMap = new Map<string, StripeResult>();

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-12-18.acacia" as any,
    });

    const paidRows = rows.filter((o) => {
      const hasPi  = o.stripe_payment_intent_id || o.payment_intent_id;
      const hasSes = o.stripe_checkout_session_id || o.stripe_session_id;
      return (o.payment_status === "paid" || o.payment_status === "paid_manual_verified") && (hasPi || hasSes);
    });

    const toCheck = paidRows.slice(0, STRIPE_LOOKUP_CAP);
    const skipped = paidRows.slice(STRIPE_LOOKUP_CAP);

    // Mark skipped rows
    for (const o of skipped) {
      stripeResultMap.set(o.id, {
        gross: null, fees: null, net: null, status: null,
        recon_status: "not_checked",
        mismatch_reason: "Stripe lookup skipped (export limit reached)",
      });
    }

    // Parallel Stripe lookups
    await Promise.allSettled(
      toCheck.map(async (o) => {
        const price    = Number(o.final_price ?? o.base_price ?? 0);
        const piId     = o.stripe_payment_intent_id || o.payment_intent_id;
        const sesId    = o.stripe_checkout_session_id || o.stripe_session_id;

        try {
          let pi: Stripe.PaymentIntent | null = null;

          if (piId) {
            pi = await stripe.paymentIntents.retrieve(piId, {
              expand: ["latest_charge.balance_transaction"],
            });
          } else if (sesId) {
            const session = await stripe.checkout.sessions.retrieve(sesId);
            if (session.payment_intent) {
              pi = await stripe.paymentIntents.retrieve(
                session.payment_intent as string,
                { expand: ["latest_charge.balance_transaction"] }
              );
            }
          }

          if (!pi) {
            stripeResultMap.set(o.id, {
              gross: null, fees: null, net: null, status: null,
              recon_status: "fetch_failed",
              mismatch_reason: "Could not fetch Stripe PaymentIntent",
            });
            return;
          }

          const stripeAmount = pi.amount_received / 100;
          const charge       = pi.latest_charge as Stripe.Charge | null;
          const bt           = charge?.balance_transaction as Stripe.BalanceTransaction | null;
          const stripeFees   = bt ? bt.fee / 100 : null;
          const stripeNet    = bt ? bt.net / 100 : null;

          if (pi.status !== "succeeded") {
            stripeResultMap.set(o.id, {
              gross: stripeAmount, fees: stripeFees, net: stripeNet,
              status: pi.status,
              recon_status: "stripe_not_confirmed",
              mismatch_reason: `Stripe status is "${pi.status}", expected "succeeded"`,
            });
            return;
          }

          const diff = Math.abs(stripeAmount - price);
          if (diff > AMOUNT_TOLERANCE) {
            stripeResultMap.set(o.id, {
              gross: stripeAmount, fees: stripeFees, net: stripeNet,
              status: pi.status,
              recon_status: "mismatch",
              mismatch_reason: `Amount mismatch: RideCheck $${price.toFixed(2)}, Stripe $${stripeAmount.toFixed(2)}`,
            });
            return;
          }

          stripeResultMap.set(o.id, {
            gross: stripeAmount, fees: stripeFees, net: stripeNet,
            status: pi.status,
            recon_status: "confirmed",
            mismatch_reason: "",
          });
        } catch (err: any) {
          stripeResultMap.set(o.id, {
            gross: null, fees: null, net: null, status: null,
            recon_status: "fetch_failed",
            mismatch_reason: err?.message ?? "Stripe fetch error",
          });
        }
      })
    );

    // ── Build CSV ─────────────────────────────────────────────────────────────
    const HEADERS = [
      "order_number",
      "created_at",
      "buyer_name",
      "package",
      "final_price",
      "payment_status",
      "ops_status",
      "report_status",
      "stripe_checkout_session_id",
      "stripe_payment_intent_id",
      "reconciliation_status",
      "stripe_gross",
      "stripe_fees",
      "stripe_net",
      "mismatch_reason",
    ];

    const lines: string[] = [HEADERS.join(",")];

    for (const o of rows) {
      const sr       = stripeResultMap.get(o.id);
      const price    = Number(o.final_price ?? o.base_price ?? 0);
      const hasPi    = o.stripe_payment_intent_id || o.payment_intent_id;
      const hasSes   = o.stripe_checkout_session_id || o.stripe_session_id;
      const hasStripe = !!(hasPi || hasSes);

      let reconStatus    = "";
      let mismatchReason = "";
      let stripeGross    = "";
      let stripeFees     = "";
      let stripeNet      = "";

      if (sr) {
        reconStatus    = sr.recon_status;
        mismatchReason = sr.mismatch_reason;
        stripeGross    = sr.gross    !== null ? sr.gross.toFixed(2)  : "";
        stripeFees     = sr.fees     !== null ? sr.fees.toFixed(2)   : "";
        stripeNet      = sr.net      !== null ? sr.net.toFixed(2)    : "";
      } else if (
        o.payment_status === "paid" ||
        o.payment_status === "paid_manual_verified"
      ) {
        reconStatus    = hasStripe ? "not_checked" : "no_stripe_id";
        mismatchReason = hasStripe ? "" : "No Stripe payment intent or session ID on record";
      }

      lines.push(
        csvRow([
          o.order_number || o.id,
          o.created_at   ? new Date(o.created_at).toISOString() : "",
          o.customer_name,
          o.package,
          price > 0 ? price.toFixed(2) : "",
          o.payment_status,
          o.ops_status,
          o.report_status,
          o.stripe_checkout_session_id || o.stripe_session_id || "",
          o.stripe_payment_intent_id   || o.payment_intent_id || "",
          reconStatus,
          stripeGross,
          stripeFees,
          stripeNet,
          mismatchReason,
        ])
      );
    }

    const csv      = lines.join("\n");
    const filename = `ridecheck-revenue-${from}-to-${to}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type":        "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err: any) {
    console.error("[revenue/export]", err);
    return NextResponse.json(
      { error: err?.message ?? "Export failed" },
      { status: 500 }
    );
  }
}
