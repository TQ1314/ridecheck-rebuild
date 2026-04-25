// app/api/ridechecker/training/status/route.ts
// GET — return current training completion status for the authenticated ridechecker.
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const [profileResult, trainingResult] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("training_sip4_completed")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("ridechecker_training_results")
        .select("score, passed, attempts, completed_at")
        .eq("ridechecker_id", userId)
        .eq("module_id", "sip4")
        .maybeSingle(),
    ]);

    return NextResponse.json({
      training_sip4_completed: profileResult.data?.training_sip4_completed ?? false,
      result: trainingResult.data
        ? {
            score: trainingResult.data.score,
            passed: trainingResult.data.passed,
            attempts: trainingResult.data.attempts,
            completed_at: trainingResult.data.completed_at,
          }
        : null,
    });
  } catch (err: any) {
    console.error("[training/status] Error:", err?.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
