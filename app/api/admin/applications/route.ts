// app/api/admin/applications/route.ts
// Admin endpoint for managing ridechecker_applications.
// GET: list all applications (with optional status filter)
// PATCH: update status, review_notes, or send invite on approval
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/rbac";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(["admin", "owner", "operations_lead"]);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let query = supabaseAdmin
    .from("ridechecker_applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ applications: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(["admin", "owner", "operations_lead"]);
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { id, action, review_notes } = body as {
    id?: string;
    action?: string;
    review_notes?: string;
  };

  if (!id || !action) {
    return NextResponse.json({ error: "id and action are required" }, { status: 400 });
  }

  const { data: app, error: fetchErr } = await supabaseAdmin
    .from("ridechecker_applications")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  if (action === "under_review") {
    await supabaseAdmin
      .from("ridechecker_applications")
      .update({ status: "under_review", updated_at: now })
      .eq("id", id);
    return NextResponse.json({ success: true, status: "under_review" });
  }

  if (action === "reject") {
    await supabaseAdmin
      .from("ridechecker_applications")
      .update({
        status: "rejected",
        reviewed_at: now,
        reviewed_by: auth.actor.userId,
        review_notes: review_notes || null,
        updated_at: now,
      })
      .eq("id", id);

    // Best-effort rejection email
    try {
      const { sendEmail } = await import("@/lib/notifications/email");
      await sendEmail({
        to: app.email,
        subject: "Your RideCheck Application Update",
        html: `<p>Hi ${app.full_name},</p>
<p>Thank you for applying to be a RideChecker. After reviewing your application, we are not moving forward at this time.</p>
${review_notes ? `<p>Notes from our team: ${review_notes}</p>` : ""}
<p>We appreciate your interest and encourage you to reapply in the future.</p>
<p>— The RideCheck Team</p>`,
      });
    } catch (e) {
      console.error("[applications] Rejection email error:", e);
    }

    return NextResponse.json({ success: true, status: "rejected" });
  }

  if (action === "approve") {
    // Generate invite token and create a user_invite record
    const token = nanoid(40);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: inviteErr } = await supabaseAdmin
      .from("user_invites")
      .insert({
        email: app.email,
        role: "ridechecker",
        token,
        expires_at: expiresAt.toISOString(),
        created_by: auth.actor.userId,
      });

    if (inviteErr) {
      console.error("[applications] Invite insert error:", inviteErr.message);
      return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
    }

    await supabaseAdmin
      .from("ridechecker_applications")
      .update({
        status: "approved",
        reviewed_at: now,
        reviewed_by: auth.actor.userId,
        review_notes: review_notes || null,
        updated_at: now,
      })
      .eq("id", id);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const onboardingUrl = `${appUrl}/invite/${token}`;

    // Send approval + onboarding link email
    try {
      const { sendEmail } = await import("@/lib/notifications/email");
      await sendEmail({
        to: app.email,
        subject: "You're approved! Set up your RideChecker account",
        html: `<p>Hi ${app.full_name},</p>
<p>Congratulations — your RideChecker application has been approved!</p>
<p>Click the link below to set up your account. This link expires in <strong>7 days</strong>.</p>
<p><a href="${onboardingUrl}" style="display:inline-block;padding:12px 24px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Set Up My Account</a></p>
<p>Or copy this link: ${onboardingUrl}</p>
<p>— The RideCheck Team</p>`,
      });
    } catch (e) {
      console.error("[applications] Approval email error:", e);
    }

    return NextResponse.json({ success: true, status: "approved", onboarding_url: onboardingUrl });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
