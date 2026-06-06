import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const GOAL_CENTS = 1_000_000;

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("ridecheck_credits")
      .select("amount_cents")
      .eq("session_type", "founding_supporter");

    if (error) {
      console.error("[founding/stats]", error);
      return NextResponse.json({ total_raised_cents: 0, supporter_count: 0, goal_cents: GOAL_CENTS });
    }

    const rows               = data ?? [];
    const total_raised_cents = rows.reduce((s, r) => s + (r.amount_cents ?? 0), 0);
    const supporter_count    = rows.length;

    return NextResponse.json({ total_raised_cents, supporter_count, goal_cents: GOAL_CENTS });
  } catch (err) {
    console.error("[founding/stats]", err);
    return NextResponse.json({ total_raised_cents: 0, supporter_count: 0, goal_cents: GOAL_CENTS });
  }
}
