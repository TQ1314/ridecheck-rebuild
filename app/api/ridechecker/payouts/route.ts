import { NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
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
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker_active", "ridechecker", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = session.user.id;

    const { data: payoutData, error } = await supabaseAdmin
      .from("ridechecker_payouts")
      .select(`
        id,
        order_id,
        base_pay,
        bonus,
        bonus_breakdown,
        total_pay,
        status,
        payout_batch_id,
        notes,
        approved_at,
        paid_at,
        created_at,
        order:orders!order_id (vehicle_year, vehicle_make, vehicle_model, inspection_datetime)
      `)
      .eq("ridechecker_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      // If table doesn't exist yet, return empty (migration may be pending)
      if (error.code === "42P01") {
        return NextResponse.json({
          payouts: [],
          summary: { total_earned: 0, pending: 0, approved: 0, paid: 0, total_jobs: 0 },
        });
      }
      console.error("[ridechecker/payouts GET error]", error);
      return NextResponse.json({ error: "Failed to fetch payouts" }, { status: 500 });
    }

    const list = (payoutData ?? []).map((p: any) => ({
      id: p.id,
      order_id: p.order_id,
      base_pay: p.base_pay ?? 0,
      bonus: p.bonus ?? 0,
      bonus_breakdown: p.bonus_breakdown ?? null,
      total_pay: p.total_pay ?? 0,
      status: p.status,
      payout_batch_id: p.payout_batch_id ?? null,
      notes: p.notes ?? null,
      approved_at: p.approved_at ?? null,
      paid_at: p.paid_at ?? null,
      created_at: p.created_at,
      vehicle_label: p.order
        ? [p.order.vehicle_year, p.order.vehicle_make, p.order.vehicle_model].filter(Boolean).join(" ")
        : null,
      scheduled_date: p.order?.inspection_datetime ? p.order.inspection_datetime.split("T")[0] : null,
    }));

    const total_earned = list.reduce((s: number, p: any) => s + p.total_pay, 0);
    const pending = list.filter((p: any) => p.status === "pending").reduce((s: number, p: any) => s + p.total_pay, 0);
    const approved = list.filter((p: any) => p.status === "approved").reduce((s: number, p: any) => s + p.total_pay, 0);
    const paid = list.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + p.total_pay, 0);

    return NextResponse.json({
      payouts: list,
      summary: {
        total_earned,
        pending,
        approved,
        paid,
        total_jobs: list.length,
      },
    });
  } catch (err: any) {
    console.error("[ridechecker/payouts error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
