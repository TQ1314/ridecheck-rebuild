import { NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
      .select("role, referral_code")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker_active", "ridechecker", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = session.user.id;

    const { data: referrals } = await supabaseAdmin
      .from("referrals")
      .select("id, referee_id, status, referee_completed_jobs, reward_amount, qualified_at, expires_at, created_at")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false });

    const refereeIds = (referrals || []).map((r: any) => r.referee_id);
    let refereeProfiles: any[] = [];
    if (refereeIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", refereeIds);
      refereeProfiles = data || [];
    }

    const refereeMap: Record<string, string> = {};
    for (const p of refereeProfiles) {
      refereeMap[p.id] = p.full_name || "RideChecker";
    }

    const enriched = (referrals || []).map((r: any) => ({
      ...r,
      referee_name: refereeMap[r.referee_id] || "RideChecker",
    }));

    const totalReferred = enriched.length;
    const qualified = enriched.filter((r: any) => r.status === "qualified").length;
    const pending = enriched.filter((r: any) => r.status === "pending").length;
    const totalRewardEarned = qualified * 100;

    return NextResponse.json({
      referralCode: profile.referral_code,
      referrals: enriched,
      stats: {
        totalReferred,
        qualified,
        pending,
        totalRewardEarned,
      },
    });
  } catch (err: any) {
    console.error("[referrals error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
