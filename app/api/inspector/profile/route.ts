import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export async function GET() {
  try {
    const result = await requireRole(["inspector", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const { data: inspector } = await supabaseAdmin
      .from("inspectors")
      .select("*")
      .eq("user_id", actor.userId)
      .maybeSingle();

    if (!inspector && actor.role !== "owner") {
      return NextResponse.json({ error: "Inspector profile not found" }, { status: 404 });
    }

    return NextResponse.json({ inspector });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
