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
    const logoUrl = `${appUrl}/ridecheck-logo.jpg`;

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
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f7f4">
          <!-- Header -->
          <div style="background:#22774F;padding:36px 24px 28px;border-radius:10px 10px 0 0;text-align:center">
            <img src="${logoUrl}" alt="RideCheck" width="64" height="64"
                 style="display:block;margin:0 auto 16px;border-radius:4px;border:3px solid rgba(255,255,255,0.25)" />
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.3px">RideCheck</h1>
            <p style="color:rgba(255,255,255,0.80);margin:4px 0 0;font-size:13px;letter-spacing:0.5px;text-transform:uppercase">Pre-Purchase Vehicle Intelligence</p>
          </div>
          <!-- Body -->
          <div style="background:#ffffff;border:1px solid #dde8e1;border-top:none;border-radius:0 0 10px 10px;padding:36px 32px">
            <p style="margin:0 0 8px;font-size:17px;font-weight:600;color:#111827">Password reset request</p>
            <p style="margin:0 0 8px;color:#4b5563;font-size:15px;line-height:1.6">Hi ${profile.full_name || profile.email},</p>
            <p style="margin:0 0 28px;color:#4b5563;font-size:15px;line-height:1.6">
              Your administrator has sent you a password reset for your <strong style="color:#22774F">RideCheck</strong> account.
              Click the button below to set a new password and sign in.
            </p>
            <!-- CTA Button -->
            <div style="text-align:center;margin:0 0 32px">
              <a href="${resetUrl}"
                 style="display:inline-block;background:#22774F;color:#ffffff;padding:15px 36px;border-radius:7px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.2px;box-shadow:0 2px 8px rgba(34,119,79,0.30)">
                Reset My Password →
              </a>
            </div>
            <!-- Divider -->
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px" />
            <!-- Fallback link -->
            <p style="margin:0 0 6px;font-size:12px;color:#6b7280">Or paste this link in your browser:</p>
            <p style="margin:0 0 24px;font-size:11px;color:#9ca3af;word-break:break-all;background:#f9fafb;border:1px solid #e5e7eb;border-radius:5px;padding:10px">${resetUrl}</p>
            <!-- Footer note -->
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">
              This link expires in <strong>1 hour</strong>. If you didn't request this reset, you can safely ignore this email.
            </p>
          </div>
          <!-- Email footer -->
          <div style="text-align:center;padding:16px 24px">
            <p style="margin:0;font-size:11px;color:#9ca3af">© RideCheck · Pre-Purchase Vehicle Intelligence</p>
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
