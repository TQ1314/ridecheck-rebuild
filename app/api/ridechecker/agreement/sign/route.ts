import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/rbac";
import {
  CURRENT_AGREEMENT_VERSION,
  CURRENT_AGREEMENT_TITLE,
  AGREEMENT_TEXT,
} from "@/lib/agreements/rccpa-v1-2026-06";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  signed_name: z.string().min(2, "Legal name must be at least 2 characters").max(200),
  confirmed: z.literal(true, { errorMap: () => ({ message: "You must check the agreement checkbox" }) }),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, role, full_name, agreement_status, current_agreement_version")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker", "ridechecker_active", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { signed_name } = parsed.data;

    const ip_address =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const user_agent = req.headers.get("user-agent") || null;
    const now = new Date().toISOString();

    const { data: agreementRecord, error: insertErr } = await supabaseAdmin
      .from("ridechecker_agreements")
      .insert({
        ridechecker_id:         session.user.id,
        agreement_version:      CURRENT_AGREEMENT_VERSION,
        agreement_title:        CURRENT_AGREEMENT_TITLE,
        signed_name,
        signed_at:              now,
        ip_address,
        user_agent,
        agreement_text_snapshot: AGREEMENT_TEXT,
        status:                 "signed",
      })
      .select("id")
      .single();

    if (insertErr || !agreementRecord) {
      console.error("[agreement sign insert error]", insertErr);
      return NextResponse.json({ error: "Failed to record agreement" }, { status: 500 });
    }

    const { error: profileUpdateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        agreement_status:           "signed",
        current_agreement_version:  CURRENT_AGREEMENT_VERSION,
        agreement_signed_at:        now,
      })
      .eq("id", session.user.id);

    if (profileUpdateErr) {
      console.error("[agreement sign profile update error]", profileUpdateErr);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    await writeAuditLog({
      actorId:    session.user.id,
      actorEmail: session.user.email ?? "",
      actorRole:  profile.role,
      action:     "ridechecker.agreement_signed",
      resourceId: session.user.id,
      oldValue:   {
        agreement_status:          profile.agreement_status,
        current_agreement_version: profile.current_agreement_version,
      },
      newValue: {
        agreement_status:          "signed",
        current_agreement_version: CURRENT_AGREEMENT_VERSION,
        agreement_id:              agreementRecord.id,
        signed_name,
      },
    });

    return NextResponse.json({
      success:   true,
      agreement_id: agreementRecord.id,
      signed_at:    now,
      version:   CURRENT_AGREEMENT_VERSION,
    });
  } catch (err) {
    console.error("[agreement sign error]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
