import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { inspectorId: string } }
) {
  const result = await requireRole(["owner", "operations_lead", "operations", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const id = params.inspectorId;

  const [mappingRes, lastLogRes] = await Promise.all([
    supabaseAdmin
      .from("connecteam_mappings")
      .select("id, connecteam_name, connecteam_status, notes, created_at, updated_at")
      .eq("profile_id", id)
      .maybeSingle(),
    supabaseAdmin
      .from("connecteam_logs")
      .select("action, created_at")
      .eq("ridechecker_id", id)
      .eq("action", "ridechecker_notified")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    mapping: mappingRes.data ?? null,
    last_notified_at: lastLogRes.data?.created_at ?? null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { inspectorId: string } }
) {
  const result = await requireRole(["owner", "operations_lead", "operations", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const id = params.inspectorId;
  const body = await req.json().catch(() => ({}));
  const { connecteam_name, connecteam_status, notes } = body;

  if (connecteam_status && !["active", "inactive"].includes(connecteam_status)) {
    return NextResponse.json(
      { error: "connecteam_status must be active or inactive" },
      { status: 400 }
    );
  }

  // Upsert — insert if no mapping exists, update if it does
  const { data, error } = await supabaseAdmin
    .from("connecteam_mappings")
    .upsert(
      {
        profile_id: id,
        connecteam_name: connecteam_name ?? null,
        connecteam_status: connecteam_status ?? "active",
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" }
    )
    .select("id, connecteam_name, connecteam_status, notes, updated_at")
    .single();

  if (error) {
    console.error("[connecteam mapping PATCH error]", error);
    return NextResponse.json({ error: "Failed to save mapping" }, { status: 500 });
  }

  return NextResponse.json({ mapping: data });
}
