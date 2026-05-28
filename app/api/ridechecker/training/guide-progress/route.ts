import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET — return guide completion status for the current user
export async function GET() {
  const supabase = createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["ridechecker_active", "owner", "operations_lead"];
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!prof || !allowed.includes(prof.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: result } = await supabaseAdmin
    .from("ridechecker_training_results")
    .select("passed, score, completed_at, attempts")
    .eq("ridechecker_id", session.user.id)
    .eq("module_id", "operations_guide")
    .maybeSingle();

  return NextResponse.json({
    completed: result?.passed === true,
    completed_at: result?.completed_at ?? null,
    score: result?.score ?? 0,
    attempts: result?.attempts ?? 0,
  });
}

// POST — mark the operations guide as completed
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["ridechecker_active", "owner", "operations_lead"];
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!prof || !allowed.includes(prof.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();

  // Upsert into ridechecker_training_results — reuse existing table with new module_id
  const { error } = await supabaseAdmin
    .from("ridechecker_training_results")
    .upsert(
      {
        ridechecker_id: session.user.id,
        module_id: "operations_guide",
        score: 100,
        passed: true,
        attempts: 1,
        completed_at: now,
        updated_at: now,
      },
      { onConflict: "ridechecker_id,module_id" }
    );

  if (error) {
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }

  return NextResponse.json({ completed: true, completed_at: now });
}
