import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { sendEmail } from "@/lib/email/resend";
import { z } from "zod";
import { getAppUrl } from "@/lib/app-url";

// Human-readable token: 12 uppercase alphanumeric chars (no 0/O, 1/I confusion)
// Example: K8MZWNTQ4RXA → www.ridecheckauto.com/invite/K8MZWNTQ4RXA
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateInviteToken(): string {
  const chars: string[] = [];
  const array = new Uint8Array(12);
  const { randomFillSync } = require("crypto");
  randomFillSync(array);
  for (const byte of array) {
    chars.push(TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]);
  }
  return chars.join("");
}

const APP_URL = getAppUrl();

const ROLE_LABELS: Record<string, string> = {
  customer: "Customer",
  operations: "Operations",
  operations_lead: "Operations Lead",
  ridechecker: "RideChecker (Pending)",
  ridechecker_active: "RideChecker",
  inspector: "Inspector",
  qa: "QA Reviewer",
  developer: "Developer",
  platform: "Platform Admin",
};

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum([
    "customer",
    "operations",
    "operations_lead",
    "ridechecker",
    "ridechecker_active",
    "inspector",
    "qa",
    "developer",
    "platform",
  ]),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const result = await requireRole(["operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error } = await supabaseAdmin
      .from("user_invites")
      .insert({
        email,
        role: parsed.data.role,
        token,
        expires_at: expiresAt,
        created_by: actor.userId,
      })
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Invite creation error:", error);
      return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
    }

    await writeAuditLog({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "user.invited",
      resourceId: invite?.id,
      metadata: { resourceType: "user_invite" },
      newValue: { email, role: parsed.data.role },
    });

    const inviteUrl = `${APP_URL}/invite/${token}`;
    const roleLabel = ROLE_LABELS[parsed.data.role] ?? parsed.data.role;

    const logoUrl = `${APP_URL}/ridecheck-logo.jpg`;
    let emailError: string | null = null;
    try {
      await sendEmail({
        to: email,
        subject: "You're invited to RideCheck",
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
              <p style="margin:0 0 8px;font-size:17px;font-weight:600;color:#111827">You've been invited</p>
              <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6">
                You've been added to the <strong style="color:#22774F">RideCheck</strong> platform as a
                <strong style="color:#22774F">${roleLabel}</strong>. Click the button below to set your password and get started.
              </p>
              <!-- CTA Button -->
              <div style="text-align:center;margin:0 0 32px">
                <a href="${inviteUrl}"
                   style="display:inline-block;background:#22774F;color:#ffffff;padding:15px 36px;border-radius:7px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.2px;box-shadow:0 2px 8px rgba(34,119,79,0.30)">
                  Accept Invitation →
                </a>
              </div>
              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px" />
              <!-- Fallback link -->
              <p style="margin:0 0 6px;font-size:12px;color:#6b7280">Or paste this link in your browser:</p>
              <p style="margin:0 0 24px;font-size:11px;color:#9ca3af;word-break:break-all;background:#f9fafb;border:1px solid #e5e7eb;border-radius:5px;padding:10px">${inviteUrl}</p>
              <!-- Footer note -->
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">
                This invitation expires in <strong>7 days</strong>. If you weren't expecting this email, you can safely ignore it.
              </p>
            </div>
            <!-- Email footer -->
            <div style="text-align:center;padding:16px 24px">
              <p style="margin:0;font-size:11px;color:#9ca3af">© RideCheck · Pre-Purchase Vehicle Intelligence</p>
            </div>
          </div>
        `,
      });
    } catch (err: any) {
      console.error("[invite] email send failed:", err);
      emailError = err.message || "Email delivery failed";
    }

    return NextResponse.json({
      invite,
      inviteUrl,
      emailSent: !emailError,
      emailError: emailError ?? undefined,
    });
  } catch (err: any) {
    console.error("Invite error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await requireRole(["operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;

    const { data, error } = await supabaseAdmin
      .from("user_invites")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 });
    }

    const invites = (data || []).map((inv) => ({
      ...inv,
      inviteUrl: `${APP_URL}/invite/${inv.token}`,
    }));

    return NextResponse.json({ invites });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
