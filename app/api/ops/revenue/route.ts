import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["admin", "owner", "operations_lead", "ops_lead"];

const PACKAGES = ["standard", "basic", "plus", "premium", "exotic"];

export async function GET(req: NextRequest) {
  try {
    const result = await requireRole(ALLOWED_ROLES);
    if (!isAuthorized(result)) return result.error;

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to   = searchParams.get("to");
    const pkg  = searchParams.get("package");
    const pmnt = searchParams.get("payment_status");
    const ops  = searchParams.get("ops_status");

    // Default: current calendar month
    const now       = new Date();
    const todayStr  = now.toISOString().split("T")[0];
    const fromStr   = from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const toStr     = to   || todayStr;

    let query = supabaseAdmin
      .from("orders")
      .select(
        "id, created_at, vehicle_year, vehicle_make, vehicle_model, package, " +
        "payment_status, ops_status, report_status, final_price, base_price, " +
        "payment_intent_id, stripe_payment_intent_id, stripe_checkout_session_id, stripe_session_id"
      )
      .gte("created_at", fromStr + "T00:00:00.000Z")
      .lte("created_at", toStr   + "T23:59:59.999Z")
      .order("created_at", { ascending: false });

    if (pkg  && pkg  !== "all") query = query.eq("package", pkg);
    if (pmnt && pmnt !== "all") query = query.eq("payment_status", pmnt);
    if (ops  && ops  !== "all") query = query.eq("ops_status", ops);

    const { data: orders, error } = await query;
    if (error) throw error;

    const rows = (orders ?? []) as any[];

    // ── Date helpers ──────────────────────────────────────────────────────────
    const todayStart = todayStr + "T00:00:00.000Z";

    const isToday = (d: string) => d >= todayStart;
    const isPaid  = (o: any) =>
      o.payment_status === "paid" || o.payment_status === "paid_manual_verified";
    const isDone  = (o: any) =>
      o.ops_status === "completed" || o.report_status === "delivered";
    const price   = (o: any) => Number(o.final_price ?? o.base_price ?? 0);

    // ── Aggregations ──────────────────────────────────────────────────────────
    const totalCount    = rows.length;
    const todayCount    = rows.filter((o) => isToday(o.created_at)).length;

    const paidRows      = rows.filter(isPaid);
    const paidCount     = paidRows.length;
    const paidGross     = paidRows.reduce((s, o) => s + price(o), 0);
    const paidToday     = paidRows.filter((o) => isToday(o.created_at));
    const paidTodayCount = paidToday.length;
    const paidTodayGross = paidToday.reduce((s, o) => s + price(o), 0);

    const completedRows = rows.filter((o) => isPaid(o) && isDone(o));
    const completedCount = completedRows.length;
    const completedGross = completedRows.reduce((s, o) => s + price(o), 0);

    // ── By package ─────────────────────────────────────────────────────────────
    const byPackage: Record<string, { count: number; gross: number }> = {};
    for (const pkg of PACKAGES) byPackage[pkg] = { count: 0, gross: 0 };
    for (const o of paidRows) {
      const p = (o.package || "standard") as string;
      if (!byPackage[p]) byPackage[p] = { count: 0, gross: 0 };
      byPackage[p].count++;
      byPackage[p].gross += price(o);
    }

    // ── Orders with Stripe IDs (for reconcile eligibility) ───────────────────
    const stripeLinked  = paidRows.filter((o) =>
      o.stripe_payment_intent_id || o.payment_intent_id ||
      o.stripe_checkout_session_id || o.stripe_session_id
    ).length;

    const manualVerified = paidRows.filter(
      (o) => o.payment_status === "paid_manual_verified"
    ).length;

    return NextResponse.json({
      period: { from: fromStr, to: toStr },
      total_jobs: {
        count: totalCount,
        today_count: todayCount,
      },
      paid_jobs: {
        count:          paidCount,
        gross_total:    paidGross,
        today_count:    paidTodayCount,
        today_gross:    paidTodayGross,
        by_package:     byPackage,
        stripe_linked:  stripeLinked,
        manual_verified: manualVerified,
      },
      completed_jobs: {
        count:       completedCount,
        gross_total: completedGross,
      },
      reconcile_eligible: stripeLinked,
    });
  } catch (err: any) {
    console.error("[ops/revenue]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
