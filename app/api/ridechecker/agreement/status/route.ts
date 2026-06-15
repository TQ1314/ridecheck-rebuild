import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  CURRENT_AGREEMENT_VERSION,
  CURRENT_AGREEMENT_TITLE,
  hasSignedCurrentAgreement,
  getAgreementStatusLabel,
} from "@/lib/agreements/rccpa-v1-2026-06";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, role, agreement_status, current_agreement_version, agreement_signed_at")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker", "ridechecker_active", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const effectiveStatus = getAgreementStatusLabel(
      (profile as any).agreement_status,
      (profile as any).current_agreement_version
    );

    const { data: latestRecord } = await supabaseAdmin
      .from("ridechecker_agreements")
      .select("id, agreement_version, agreement_title, signed_name, signed_at, status")
      .eq("ridechecker_id", session.user.id)
      .eq("agreement_version", CURRENT_AGREEMENT_VERSION)
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      required_version:     CURRENT_AGREEMENT_VERSION,
      required_title:       CURRENT_AGREEMENT_TITLE,
      effective_status:     effectiveStatus,
      has_signed_current:   hasSignedCurrentAgreement(profile as any),
      profile_status:       (profile as any).agreement_status ?? "not_signed",
      profile_version:      (profile as any).current_agreement_version ?? null,
      profile_signed_at:    (profile as any).agreement_signed_at ?? null,
      latest_record:        latestRecord ?? null,
    });
  } catch (err) {
    console.error("[agreement status error]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
