import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await requireRole(["operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;

    const { data, error } = await supabaseAdmin
      .from("role_definitions")
      .select("*")
      .order("role", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
    }

    return NextResponse.json({ roles: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
