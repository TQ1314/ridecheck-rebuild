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

    let emailError: string | null = null;
    try {
      await sendEmail({
        to: email,
        subject: "You're invited to RideCheck",
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
            <div style="background:#059669;padding:24px;border-radius:8px 8px 0 0;text-align:center">
              <h1 style="color:white;margin:0;font-size:22px;font-weight:700">Welcome to RideCheck</h1>
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:32px">
              <p style="margin:0 0 12px;font-size:16px">Hi there,</p>
              <p style="margin:0 0 24px;color:#374151;font-size:15px">
                You've been invited to join the <strong>RideCheck</strong> platform as a
                <strong>${roleLabel}</strong>. Click the button below to set your password and get started.
              </p>
              <div style="text-align:center;margin:0 0 28px">
                <a href="${inviteUrl}"
                   style="display:inline-block;background:#059669;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">
                  Accept Invitation
                </a>
              </div>
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280">
                Or copy this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:12px;color:#9ca3af;word-break:break-all">
                ${inviteUrl}
              </p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px" />
              <p style="margin:0;font-size:12px;color:#9ca3af">
                This invitation expires in 7 days. If you weren't expecting this, you can safely ignore it.
              </p>
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
