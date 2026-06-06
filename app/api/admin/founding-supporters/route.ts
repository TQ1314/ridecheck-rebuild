import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const result = await requireRole(["admin", "owner", "operations_lead"]);
  if (!isAuthorized(result)) return result.error;

  const url    = new URL(req.url);
  const limit  = Math.min(parseInt(url.searchParams.get("limit")  ?? "200", 10), 500);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const { data: credits, error } = await supabaseAdmin
    .from("ridecheck_credits")
    .select("*")
    .eq("session_type", "founding_supporter")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[admin/founding-supporters]", error);
    return NextResponse.json({ error: "Failed to load credits" }, { status: 500 });
  }

  const rows               = credits ?? [];
  const total_raised_cents = rows.reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const active_count       = rows.filter((r) => r.status === "active").length;
  const redeemed_count     = rows.filter((r) => r.status === "redeemed").length;
  const now                = new Date();
  const thirty             = new Date(now.getTime() + 30 * 24 * 3_600_000);
  const expiring_soon      = rows.filter((r) => {
    if (r.status !== "active") return false;
    const exp = new Date(r.expires_at);
    return exp > now && exp <= thirty;
  }).length;

  return NextResponse.json({
    credits: rows,
    stats: {
      supporter_count: rows.length,
      total_raised_cents,
      active_count,
      redeemed_count,
      expiring_soon_count: expiring_soon,
    },
  });
}
