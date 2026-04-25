// app/api/ridechecker/training/submit/route.ts
// POST — grade a Module SIP-4 quiz attempt.
//
// SECURITY: Answer key lives ONLY here (server-side).
// The frontend never receives correct answers — only the pass/fail result.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MODULE_ID = "sip4";
const PASS_THRESHOLD = 80; // percent

// ── Answer key (server-only) ──────────────────────────────────
// Keys are question IDs; values are the single correct option letter.
const ANSWER_KEY: Record<string, string> = {
  q1: "b",
  q2: "c",
  q3: "c",
  q4: "c",
  q5: "c",
};

const TOTAL = Object.keys(ANSWER_KEY).length;

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Only ridechecker_active (and owner for testing) can submit
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const allowedRoles = ["ridechecker_active", "owner", "operations_lead"];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!profile.is_active && profile.role !== "owner") {
      return NextResponse.json({ error: "Account is not active" }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { answers } = body as { answers?: Record<string, string> };

    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return NextResponse.json({ error: "answers object is required" }, { status: 400 });
    }

    // Grade
    let correct = 0;
    for (const [qId, correctAnswer] of Object.entries(ANSWER_KEY)) {
      if (typeof answers[qId] === "string" && answers[qId].toLowerCase() === correctAnswer) {
        correct++;
      }
    }

    const score = Math.round((correct / TOTAL) * 100);
    const passed = score >= PASS_THRESHOLD;
    const now = new Date().toISOString();

    // Fetch existing result row to get current attempt count
    const { data: existing } = await supabaseAdmin
      .from("ridechecker_training_results")
      .select("id, attempts, passed")
      .eq("ridechecker_id", userId)
      .eq("module_id", MODULE_ID)
      .maybeSingle();

    const newAttempts = (existing?.attempts ?? 0) + 1;

    // Upsert: if already passed, don't overwrite the completion record
    const alreadyPassed = existing?.passed === true;

    if (!alreadyPassed) {
      await supabaseAdmin
        .from("ridechecker_training_results")
        .upsert(
          {
            ridechecker_id: userId,
            module_id: MODULE_ID,
            score,
            passed,
            attempts: newAttempts,
            completed_at: passed ? now : null,
            updated_at: now,
          },
          { onConflict: "ridechecker_id,module_id" }
        );

      if (passed) {
        await supabaseAdmin
          .from("profiles")
          .update({ training_sip4_completed: true })
          .eq("id", userId);
      }
    }

    return NextResponse.json({
      passed: passed || alreadyPassed,
      score,
      correct,
      total: TOTAL,
      attempts: newAttempts,
      already_passed: alreadyPassed,
    });
  } catch (err: any) {
    console.error("[training/submit] Error:", err?.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
