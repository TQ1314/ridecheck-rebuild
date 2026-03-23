import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";
import {
  ridecheckerApprovedHtml,
  ridecheckerRejectedHtml,
} from "@/lib/email/templates/ridechecker-approval";

export async function GET(req: NextRequest) {
  // operations can VIEW applicants; only operations_lead/owner can APPROVE (see PATCH below)
  const result = await requireRole(["owner", "operations_lead", "operations"]);
  if (!isAuthorized(result)) return result.error;

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") || "all";

  let query = supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, phone, role, service_area, experience, created_at, approved_at, rejected_at, rejection_reason, rating, referral_code")
    .in("role", ["ridechecker", "ridechecker_active"])
    .order("created_at", { ascending: false });

  if (statusFilter === "pending") {
    query = query.eq("role", "ridechecker");
  } else if (statusFilter === "active") {
    query = query.eq("role", "ridechecker_active");
  }

  const { data, error } = await query;

  if (error) {
    console.error("[admin/ridecheckers GET]", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  const pending = (data || []).filter((p: any) => p.role === "ridechecker").length;
  const active = (data || []).filter((p: any) => p.role === "ridechecker_active").length;

  return NextResponse.json({
    ridecheckers: data || [],
    stats: { total: (data || []).length, pending, active },
  });
}

export async function PATCH(req: NextRequest) {
  const result = await requireRole(["owner", "operations_lead"]);
  if (!isAuthorized(result)) return result.error;
  const { actor } = result;

  const body = await req.json();
  const { userId, action, reason } = body;

  if (!userId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", userId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.role !== "ridechecker") {
    return NextResponse.json(
      { error: "User is not a pending ridechecker" },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  if (action === "approve") {
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        role: "ridechecker_active",
        approved_at: new Date().toISOString(),
        approved_by: actor.userId,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[approve error]", updateError);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    await writeAuditLog({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "ridechecker.approve",
      resourceId: userId,
      oldValue: { role: "ridechecker" },
      newValue: { role: "ridechecker_active" },
    });

    if (target.email) {
      await sendEmail({
        to: target.email,
        subject: "Your RideChecker Application Has Been Approved!",
        html: ridecheckerApprovedHtml({
          name: target.full_name || "RideChecker",
          loginUrl: `${appUrl}/auth/login`,
        }),
      });
    }

    return NextResponse.json({ success: true, action: "approved" });
  }

  if (action === "reject") {
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        is_active: false,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason || null,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[reject error]", updateError);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    await writeAuditLog({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "ridechecker.reject",
      resourceId: userId,
      oldValue: { role: "ridechecker", is_active: true },
      newValue: { is_active: false, rejection_reason: reason || null },
    });

    if (target.email) {
      await sendEmail({
        to: target.email,
        subject: "RideChecker Application Update",
        html: ridecheckerRejectedHtml({
          name: target.full_name || "Applicant",
          reason: reason || undefined,
        }),
      });
    }

    return NextResponse.json({ success: true, action: "rejected" });
  }
}
