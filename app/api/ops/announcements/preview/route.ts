import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

const OPS_ROLES = ["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"];

export async function GET(req: NextRequest) {
  const auth = await requireRole(OPS_ROLES);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const group = searchParams.get("group") ?? "all";
  const area = searchParams.get("area") ?? "";

  let query = supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "ridechecker_active")
    .eq("is_active", true);

  if (group === "available") {
    query = query.eq("is_available", true);
  } else if (group === "area" && area.trim()) {
    query = query.ilike("service_area", `%${area.trim()}%`);
  }

  const { count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: count ?? 0 });
}
