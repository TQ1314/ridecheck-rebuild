import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { sendEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const result = await requireRole(["operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", params.userId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: profile.email,
        options: { redirectTo: `${appUrl}/auth/login` },
      });

    if (linkError) {
      if (linkError.message?.toLowerCase().includes("not found") || linkError.message?.toLowerCase().includes("unable to find")) {
        return NextResponse.json(
          { error: "no_auth_account", message: "This user has no Supabase auth account — send them an invite link instead." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: linkError.message || "Failed to generate reset link" },
        { status: 500 }
      );
    }

    const resetUrl = linkData?.properties?.action_link;
    if (!resetUrl) {
      return NextResponse.json({ error: "Failed to generate reset link" }, { status: 500 });
    }

    await sendEmail({
      to: profile.email,
      subject: "Reset your RideCheck password",
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
          <div style="background:#059669;padding:24px;border-radius:8px 8px 0 0;text-align:center">
            <h1 style="color:white;margin:0;font-size:20px">RideCheck — Password Reset</h1>
          </div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:32px">
            <p style="margin:0 0 16px">Hi ${profile.full_name || profile.email},</p>
            <p style="margin:0 0 24px;color:#374151">Your admin has sent you a password reset link for your RideCheck account. Click the button below to set a new password and sign in.</p>
            <a href="${resetUrl}" style="display:inline-block;background:#059669;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;margin-bottom:24px">Reset My Password</a>
            <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    });

    await writeAuditLog({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "user.password_reset_sent",
      resourceId: params.userId,
      newValue: { email: profile.email },
    });

    return NextResponse.json({ success: true, email: profile.email });
  } catch (err: any) {
    console.error("[send-reset] error:", err);
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 });
  }
}
