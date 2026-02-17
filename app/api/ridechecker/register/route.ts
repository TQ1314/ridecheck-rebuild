import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";

function generateReferralCode(name: string): string {
  const prefix = name.replace(/[^a-zA-Z]/g, "").substring(0, 4).toUpperCase();
  const suffix = nanoid(6).toUpperCase();
  return `RC-${prefix}-${suffix}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, fullName, phone, serviceArea, experience, referralCode } = body;

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

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone: phone || null,
        },
      });

    if (authError) {
      if (authError.message?.includes("already been registered")) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }
      console.error("RideChecker auth signup error:", authError);
      return NextResponse.json(
        { error: authError.message || "Failed to create account" },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    const myReferralCode = generateReferralCode(fullName);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: authData.user.id,
          email: email.toLowerCase().trim(),
          full_name: fullName.trim(),
          phone: phone?.trim() || null,
          role: "ridechecker",
          is_active: true,
          service_area: serviceArea?.trim() || null,
          experience: experience?.trim() || null,
          referral_code: myReferralCode,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      console.error("Profile creation error:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: "Failed to set up your account. Please try again." },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("referral_codes").insert({
      user_id: authData.user.id,
      code: myReferralCode,
    });

    if (referralCode) {
      const { data: referrerCode } = await supabaseAdmin
        .from("referral_codes")
        .select("user_id")
        .eq("code", referralCode.trim().toUpperCase())
        .maybeSingle();

      if (referrerCode) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await supabaseAdmin.from("referrals").insert({
          referrer_id: referrerCode.user_id,
          referee_id: authData.user.id,
          referral_code: referralCode.trim().toUpperCase(),
          status: "pending",
          referee_completed_jobs: 0,
          reward_amount: 100.00,
          expires_at: expiresAt.toISOString(),
        });
      }
    }

    await supabaseAdmin.from("audit_log").insert({
      actor_id: authData.user.id,
      actor_email: email.toLowerCase().trim(),
      actor_role: "ridechecker",
      action: "ridechecker.signup",
      resource_type: "profile",
      resource_id: authData.user.id,
      new_value: {
        email: email.toLowerCase().trim(),
        service_area: serviceArea || null,
        experience: experience || null,
        referral_code_used: referralCode || null,
        own_referral_code: myReferralCode,
      },
    });

    return NextResponse.json({
      success: true,
      message: "RideChecker account created. You can now sign in.",
    });
  } catch (err: any) {
    console.error("RideChecker registration error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
