import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await req.json();
    const { email, password, fullName, phone } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "Email, password, and full name are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("user_invites")
      .select("*")
      .eq("token", params.token)
      .maybeSingle();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.used_at) {
      return NextResponse.json({ error: "Invite already used" }, { status: 410 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invite expired" }, { status: 410 });
    }

    if (invite.email.toLowerCase() !== email.toLowerCase().trim()) {
      return NextResponse.json(
        { error: "Email does not match the invitation" },
        { status: 400 }
      );
    }

    // Resolve application linkage from the invite
    const applicationId: string | null = invite.application_id ?? null;
    const isRideCheckerInvite =
      invite.role === "ridechecker_active" || invite.role === "ridechecker";

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone: phone || null,
        },
      });

    if (authError) {
      if (authError.message?.includes("already been registered")) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase().trim()
        );
        if (existingUser) {
          const existingPatch: Record<string, unknown> = {
            id: existingUser.id,
            email: email.toLowerCase().trim(),
            full_name: fullName.trim(),
            phone: phone?.trim() || null,
            role: invite.role,
            is_active: true,
          };

          if (isRideCheckerInvite) {
            existingPatch.profile_type = "ridechecker_active";
            existingPatch.origin_type = applicationId ? "application" : "invite";
            if (applicationId) existingPatch.origin_id = applicationId;
            existingPatch.level = "level_1";
          }

          await supabaseAdmin.from("profiles").upsert(existingPatch, { onConflict: "id" });

          if (applicationId) {
            await supabaseAdmin
              .from("ridechecker_applications")
              .update({ profile_id: existingUser.id })
              .eq("id", applicationId);
          }

          await supabaseAdmin
            .from("user_invites")
            .update({ used_at: new Date().toISOString() })
            .eq("id", invite.id);

          return NextResponse.json({
            success: true,
            message: "Account updated with invited role. You can now sign in.",
          });
        }
      }
      return NextResponse.json(
        { error: authError.message || "Failed to create account" },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    const userId = authData.user.id;

    // Build profile row
    const profileRow: Record<string, unknown> = {
      id: userId,
      email: email.toLowerCase().trim(),
      full_name: fullName.trim(),
      phone: phone?.trim() || null,
      role: invite.role,
      is_active: true,
    };

    // Stamp ridechecker-specific metadata when this is an RC invite
    if (isRideCheckerInvite) {
      profileRow.profile_type = "ridechecker_active";
      profileRow.origin_type = applicationId ? "application" : "invite";
      if (applicationId) profileRow.origin_id = applicationId;
      profileRow.level = "level_1";
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profileRow, { onConflict: "id" });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      return NextResponse.json(
        { error: "Account created but profile setup failed. Contact support." },
        { status: 500 }
      );
    }

    // Backlink application → profile so admin sees the account created
    if (applicationId) {
      await supabaseAdmin
        .from("ridechecker_applications")
        .update({ profile_id: userId })
        .eq("id", applicationId);
    }

    // Legacy: seed inspectors table if role was 'inspector' (backward compat)
    if (invite.role === "inspector") {
      await supabaseAdmin.from("inspectors").insert({
        full_name: fullName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        user_id: userId,
        is_active: true,
      });
    }

    await supabaseAdmin
      .from("user_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    await supabaseAdmin.from("audit_log").insert({
      actor_id: userId,
      actor_email: email.toLowerCase().trim(),
      actor_role: invite.role,
      action: "invite.accepted",
      resource_type: "user_invite",
      resource_id: invite.id,
      new_value: { email: email.toLowerCase().trim(), role: invite.role },
    });

    return NextResponse.json({
      success: true,
      message: "Account created successfully. You can now sign in.",
    });
  } catch (err: any) {
    console.error("Accept invite error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
