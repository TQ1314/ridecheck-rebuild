// app/api/admin/applications/route.ts
// Admin endpoint for managing ridechecker_applications.
// GET: list all applications (with optional status filter)
// PATCH: update status, review_notes, or send invite on approval
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/rbac";
import { nanoid } from "nanoid";
import { getAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(["admin", "owner", "operations_lead", "operations"]);
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
  const auth = await requireRole(["admin", "owner", "operations_lead", "operations"]);
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
    // Prevent double-approval
    if (
      (app.status === "pending_verification" || app.status === "verification_submitted") &&
      app.profile_id
    ) {
      return NextResponse.json(
        { error: "This application has already been approved and a verification link was sent." },
        { status: 409 }
      );
    }

    // Generate invite token linked to this application.
    // Role is 'ridechecker' (NOT ridechecker_active) — full activation only after verification.
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
        application_id: app.id,
      });

    if (inviteErr) {
      console.error("[applications] Invite insert error:", inviteErr.message);
      return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
    }

    await supabaseAdmin
      .from("ridechecker_applications")
      .update({
        status: "pending_verification",
        reviewed_at: now,
        reviewed_by: auth.actor.userId,
        review_notes: review_notes || null,
        updated_at: now,
      })
      .eq("id", id);

    const verifySetupUrl = `${getAppUrl()}/invite/${token}`;

    // Send verification setup email
    try {
      const { sendEmail } = await import("@/lib/notifications/email");
      await sendEmail({
        to: app.email,
        subject: "Complete Your RideChecker Verification",
        html: `<p>Hi ${app.full_name},</p>
<p>You've been approved to move forward with RideCheck. Before receiving assignments, please complete identity verification and contractor acknowledgment using the secure link below.</p>
<p>
  <a href="${verifySetupUrl}" style="display:inline-block;padding:12px 24px;background:#2d7a52;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
    Complete Verification
  </a>
</p>
<p style="font-size:13px;color:#666">Or copy this link: ${verifySetupUrl}</p>
<p><strong>Important:</strong> Approval does not activate your RideChecker account until verification is reviewed and accepted. This link expires in <strong>7 days</strong>.</p>
<p>— The RideCheck Team</p>`,
      });
    } catch (e) {
      console.error("[applications] Verification email error:", e);
    }

    return NextResponse.json({ success: true, status: "pending_verification", setup_url: verifySetupUrl });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
