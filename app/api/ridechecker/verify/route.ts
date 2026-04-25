// app/api/ridechecker/verify/route.ts
// POST — RideChecker submits identity verification data.
// User must be authenticated with role 'ridechecker' and verification_status 'pending_verification'.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("role, verification_status")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.role !== "ridechecker") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (profile.verification_status === "submitted") {
      return NextResponse.json(
        { error: "Verification already submitted. Please wait for review." },
        { status: 409 }
      );
    }

    if (profile.verification_status === "active") {
      return NextResponse.json(
        { error: "Your account is already verified and active." },
        { status: 409 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const {
      legal_name,
      date_of_birth,
      address_line1,
      address_city,
      address_state,
      address_zip,
      id_document_path,
      selfie_path,
      has_reliable_transportation,
      agreement_accepted,
    } = body as Record<string, unknown>;

    if (
      typeof legal_name !== "string" || !legal_name.trim() ||
      typeof date_of_birth !== "string" || !date_of_birth ||
      typeof address_line1 !== "string" || !address_line1.trim() ||
      typeof address_city !== "string" || !address_city.trim() ||
      typeof address_state !== "string" || !address_state.trim() ||
      typeof address_zip !== "string" || !address_zip.trim() ||
      typeof id_document_path !== "string" || !id_document_path ||
      typeof selfie_path !== "string" || !selfie_path ||
      has_reliable_transportation !== true ||
      agreement_accepted !== true
    ) {
      return NextResponse.json(
        { error: "All fields are required including both file uploads and agreement." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        legal_name: (legal_name as string).trim(),
        date_of_birth: date_of_birth as string,
        address_line1: (address_line1 as string).trim(),
        address_city: (address_city as string).trim(),
        address_state: (address_state as string).trim(),
        address_zip: (address_zip as string).trim(),
        id_document_path: id_document_path as string,
        selfie_path: selfie_path as string,
        has_reliable_transportation: true,
        agreement_accepted_at: now,
        verification_status: "submitted",
        verification_submitted_at: now,
      })
      .eq("id", userId);

    if (updateErr) {
      console.error("[verify] Profile update error:", updateErr.message);
      return NextResponse.json({ error: "Failed to save verification data." }, { status: 500 });
    }

    // Update linked application status to verification_submitted
    try {
      await supabaseAdmin
        .from("ridechecker_applications")
        .update({ status: "verification_submitted", updated_at: now })
        .eq("profile_id", userId)
        .in("status", ["pending_verification", "approved"]);
    } catch (appErr) {
      console.error("[verify] Application status update error:", appErr);
    }

    // Notify admin (best-effort)
    try {
      const { sendEmail } = await import("@/lib/notifications/email");
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        const { data: p } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", userId)
          .maybeSingle();
        await sendEmail({
          to: adminEmail,
          subject: `RideChecker Verification Submitted — ${p?.full_name ?? "Unknown"}`,
          html: `<p>A RideChecker has submitted their identity verification and is awaiting review.</p>
<table style="border-collapse:collapse;width:100%;max-width:480px">
  <tr><td style="padding:4px 8px;font-weight:bold">Name</td><td style="padding:4px 8px">${p?.full_name ?? "—"}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:bold">Email</td><td style="padding:4px 8px">${p?.email ?? "—"}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:bold">Legal Name</td><td style="padding:4px 8px">${(legal_name as string).trim()}</td></tr>
</table>
<p style="margin-top:16px">
  <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/applications?filter=verification_submitted">
    Review in admin →
  </a>
</p>`,
        });
      }
    } catch (emailErr) {
      console.error("[verify] Admin notification error:", emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[verify] Unexpected error:", err?.message);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
