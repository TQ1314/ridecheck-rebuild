import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  CURRENT_AGREEMENT_VERSION,
  getAgreementStatusLabel,
} from "@/lib/agreements/rccpa-v1-2026-06";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const result = await requireRole([
      "operations", "operations_lead", "ops_lead", "admin", "owner", "ops",
    ]);
    if (!isAuthorized(result)) return result.error;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, agreement_status, current_agreement_version, agreement_signed_at")
      .eq("id", params.userId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "RideChecker not found" }, { status: 404 });
    }

    const effectiveStatus = getAgreementStatusLabel(
      (profile as any).agreement_status,
      (profile as any).current_agreement_version
    );

    const { data: agreements } = await supabaseAdmin
      .from("ridechecker_agreements")
      .select("id, agreement_version, agreement_title, signed_name, signed_at, ip_address, status")
      .eq("ridechecker_id", params.userId)
      .order("signed_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      ridechecker_id:       params.userId,
      full_name:            profile.full_name,
      email:                profile.email,
      required_version:     CURRENT_AGREEMENT_VERSION,
      effective_status:     effectiveStatus,
      profile_status:       (profile as any).agreement_status ?? "not_signed",
      profile_version:      (profile as any).current_agreement_version ?? null,
      profile_signed_at:    (profile as any).agreement_signed_at ?? null,
      agreement_history:    agreements ?? [],
    });
  } catch (err) {
    console.error("[admin agreement GET error]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
