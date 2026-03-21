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

    const { data: earnings, error } = await supabaseAdmin
      .from("ridechecker_earnings")
      .select("*")
      .eq("ridechecker_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[earnings GET error]", error);
      return NextResponse.json({ error: "Failed to fetch earnings" }, { status: 500 });
    }

    const earningsList = earnings || [];

    const totalEarned = earningsList.reduce(
      (sum: number, e: any) => sum + parseFloat(e.amount || "0"),
      0
    );
    const pendingPayout = earningsList
      .filter((e: any) => e.status === "pending")
      .reduce((sum: number, e: any) => sum + parseFloat(e.amount || "0"), 0);
    const paidOut = earningsList
      .filter((e: any) => e.status === "paid")
      .reduce((sum: number, e: any) => sum + parseFloat(e.amount || "0"), 0);

    return NextResponse.json({
      earnings: earningsList,
      summary: {
        totalEarned,
        pendingPayout,
        paidOut,
        totalJobs: earningsList.length,
      },
    });
  } catch (err: any) {
    console.error("[earnings error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
