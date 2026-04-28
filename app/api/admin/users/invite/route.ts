import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { z } from "zod";
import { getAppUrl } from "@/lib/app-url";

// Human-readable token: 12 uppercase alphanumeric chars (no 0/O, 1/I confusion)
// Example: K8MZWNTQ4RXA → www.ridecheckauto.com/invite/K8MZWNTQ4RXA
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateInviteToken(): string {
  const chars: string[] = [];
  const array = new Uint8Array(12);
  // Use Node's crypto for server-side randomness
  const { randomFillSync } = require("crypto");
  randomFillSync(array);
  for (const byte of array) {
    chars.push(TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]);
  }
  return chars.join("");
}

const APP_URL = getAppUrl();

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

    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error } = await supabaseAdmin
      .from("user_invites")
      .insert({
        email: parsed.data.email.toLowerCase().trim(),
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
      newValue: { email: parsed.data.email, role: parsed.data.role },
    });

    const inviteUrl = `${APP_URL}/invite/${token}`;

    return NextResponse.json({ invite, inviteUrl });
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

    // Attach the full invite URL server-side so the client always gets the right domain
    const invites = (data || []).map((inv) => ({
      ...inv,
      inviteUrl: `${APP_URL}/invite/${inv.token}`,
    }));

    return NextResponse.json({ invites });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
