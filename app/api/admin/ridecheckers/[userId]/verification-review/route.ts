// app/api/admin/ridecheckers/[userId]/verification-review/route.ts
// GET  — return verification data + signed doc URLs
// PATCH — approve or reject verification
import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL = 60 * 60; // 1 hour

async function getSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const { data } = await supabaseAdmin.storage
      .from("ridechecker-verifications")
      .createSignedUrl(path, SIGNED_URL_TTL);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const result = await requireRole(["admin", "owner", "operations_lead", "operations"]);
  if (!isAuthorized(result)) return result.error;

  const { userId } = params;

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, full_name, email, role, verification_status, legal_name, date_of_birth, address_line1, address_city, address_state, address_zip, id_document_path, selfie_path, has_reliable_transportation, agreement_accepted_at, verification_submitted_at, verification_reviewed_at, verification_review_notes"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const [idDocSignedUrl, selfieSignedUrl] = await Promise.all([
    getSignedUrl(profile.id_document_path),
    getSignedUrl(profile.selfie_path),
  ]);

  return NextResponse.json({
    profile: {
      ...profile,
      id_document_path: undefined,
      selfie_path: undefined,
    },
    id_document_url: idDocSignedUrl,
    selfie_url: selfieSignedUrl,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const result = await requireRole(["admin", "owner", "operations_lead", "operations"]);
  if (!isAuthorized(result)) return result.error;
  const { actor } = result;

  const { userId } = params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { action, notes } = body as { action?: string; notes?: string };

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  if (action === "reject" && (!notes || !(notes as string).trim())) {
    return NextResponse.json(
      { error: "A reason is required when rejecting verification." },
      { status: 400 }
    );
  }

  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, verification_status, role")
    .eq("id", userId)
    .maybeSingle();

  if (fetchErr || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.verification_status !== "submitted") {
    return NextResponse.json(
      { error: "No pending verification submission found." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  if (action === "approve") {
    await supabaseAdmin
      .from("profiles")
      .update({
        role: "ridechecker_active",
        is_active: true,
        verification_status: "active",
        verification_reviewed_at: now,
        verification_reviewed_by: actor.userId,
        verification_review_notes: (notes as string | undefined)?.trim() || null,
        ridechecker_is_approved: true,
        approved_at: now,
        approved_by: actor.userId,
      })
      .eq("id", userId);

    // Update application status
    await supabaseAdmin
      .from("ridechecker_applications")
      .update({ status: "active", updated_at: now })
      .eq("profile_id", userId);

    // Notify the RideChecker
    try {
      const { sendEmail } = await import("@/lib/notifications/email");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
      await sendEmail({
        to: profile.email,
        subject: "You're verified — Welcome to RideCheck!",
        html: `<p>Hi ${profile.full_name},</p>
<p>Great news — your identity verification has been reviewed and approved. Your RideChecker account is now <strong>Active</strong>.</p>
<p>You can now log in to the RideChecker portal to set your availability and start receiving vehicle assessment assignments.</p>
<p>
  <a href="${appUrl}/ridechecker/dashboard" style="display:inline-block;padding:12px 24px;background:#2d7a52;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
    Go to My Dashboard
  </a>
</p>
<p>Welcome aboard — we're glad to have you on the team.</p>
<p>— The RideCheck Team</p>`,
      });
    } catch (emailErr) {
      console.error("[verification-review] Approval email error:", emailErr);
    }

    await writeAuditLog({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "ridechecker.verification_approved",
      resourceId: userId,
      metadata: { resourceType: "profile" },
      newValue: { verification_status: "active", role: "ridechecker_active" },
    });

    return NextResponse.json({ success: true, status: "active" });
  }

  // action === "reject"
  await supabaseAdmin
    .from("profiles")
    .update({
      verification_status: "rejected",
      verification_reviewed_at: now,
      verification_reviewed_by: actor.userId,
      verification_review_notes: (notes as string).trim(),
    })
    .eq("id", userId);

  await supabaseAdmin
    .from("ridechecker_applications")
    .update({ status: "verification_rejected", updated_at: now })
    .eq("profile_id", userId);

  // Notify the RideChecker
  try {
    const { sendEmail } = await import("@/lib/notifications/email");
    await sendEmail({
      to: profile.email,
      subject: "RideChecker Verification Update",
      html: `<p>Hi ${profile.full_name},</p>
<p>Thank you for submitting your verification. After review, we were unable to approve your verification at this time.</p>
${notes ? `<p><strong>Notes from our team:</strong> ${(notes as string).trim()}</p>` : ""}
<p>Please review the feedback above and resubmit your verification with corrected information.</p>
<p>
  <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/ridechecker/verify" style="display:inline-block;padding:12px 24px;background:#2d7a52;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
    Resubmit Verification
  </a>
</p>
<p>— The RideCheck Team</p>`,
    });
  } catch (emailErr) {
    console.error("[verification-review] Rejection email error:", emailErr);
  }

  await writeAuditLog({
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "ridechecker.verification_rejected",
    resourceId: userId,
    metadata: { resourceType: "profile" },
    newValue: { verification_status: "rejected" },
    oldValue: { notes: (notes as string).trim() },
  });

  return NextResponse.json({ success: true, status: "rejected" });
}
