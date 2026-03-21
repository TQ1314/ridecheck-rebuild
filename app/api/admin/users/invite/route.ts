import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { z } from "zod";
import { randomBytes } from "crypto";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum([
    "customer",
    "operations",
    "operations_lead",
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

    const token = randomBytes(32).toString("hex");
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const inviteUrl = `${appUrl}/invite/${token}`;

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

    return NextResponse.json({ invites: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
