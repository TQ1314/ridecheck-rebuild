import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only stamp if not already viewed
    const { data: existing } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .select("id, first_viewed_at, ridechecker_id, status")
      .eq("id", params.assignmentId)
      .eq("ridechecker_id", session.user.id)
      .maybeSingle();

    if (!existing) return NextResponse.json({ ok: true });

    if (!existing.first_viewed_at && existing.status === "awaiting_acceptance") {
      await supabaseAdmin
        .from("ridechecker_job_assignments")
        .update({ first_viewed_at: new Date().toISOString() })
        .eq("id", params.assignmentId);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
