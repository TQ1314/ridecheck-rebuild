import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL_LEN = 254;
const MAX_NAME_LEN = 120;
const MAX_PHONE_LEN = 30;
const MAX_AREA_LEN = 200;
const MAX_EXPERIENCE_LEN = 1000;
const MAX_REFERRAL_LEN = 30;
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 128;

function generateReferralCode(name: string): string {
  const prefix = name.replace(/[^a-zA-Z]/g, "").substring(0, 4).toUpperCase();
  const suffix = nanoid(6).toUpperCase();
  return `RC-${prefix}-${suffix}`;
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Only destructure expected fields — ignore any extra fields the caller sends
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : null;
    const serviceArea = typeof body.serviceArea === "string" ? body.serviceArea.trim() : null;
    const experience = typeof body.experience === "string" ? body.experience.trim() : null;
    const referralCode = typeof body.referralCode === "string" ? body.referralCode.trim().toUpperCase() : null;

    // Input validation
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "Email, password, and full name are required" },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(email) || email.length > MAX_EMAIL_LEN) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (password.length < MIN_PASSWORD_LEN) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LEN} characters` },
        { status: 400 }
      );
    }

    if (password.length > MAX_PASSWORD_LEN) {
      return NextResponse.json({ error: "Password is too long" }, { status: 400 });
    }

    if (fullName.length > MAX_NAME_LEN) {
      return NextResponse.json({ error: "Name is too long" }, { status: 400 });
    }

    if (phone && phone.length > MAX_PHONE_LEN) {
      return NextResponse.json({ error: "Phone number is too long" }, { status: 400 });
    }

    if (serviceArea && serviceArea.length > MAX_AREA_LEN) {
      return NextResponse.json({ error: "Service area is too long" }, { status: 400 });
    }

    if (experience && experience.length > MAX_EXPERIENCE_LEN) {
      return NextResponse.json({ error: "Experience description is too long (max 1000 chars)" }, { status: 400 });
    }

    if (referralCode && referralCode.length > MAX_REFERRAL_LEN) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });
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
      if (
        authError.message?.includes("already been registered") ||
        authError.message?.includes("already exists")
      ) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }
      console.error("[ridechecker/register] Auth error:", authError.message);
      return NextResponse.json(
        { error: "Failed to create account. Please try again." },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    const myReferralCode = generateReferralCode(fullName);

    // Role is ALWAYS hardcoded to "ridechecker" — never read from the request body
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: authData.user.id,
          email,
          full_name: fullName,
          phone: phone || null,
          role: "ridechecker",    // ← hardcoded, cannot be overridden by caller
          is_active: true,
          service_area: serviceArea || null,
          experience: experience || null,
          referral_code: myReferralCode,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      console.error("[ridechecker/register] Profile error:", profileError.message);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: "Failed to set up your account. Please try again." },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("referral_codes").insert({
      user_id: authData.user.id,
      code: myReferralCode,
    }).then(({ error }) => {
      if (error) console.error("[ridechecker/register] Referral code insert error:", error.message);
    });

    if (referralCode) {
      const { data: referrerCode } = await supabaseAdmin
        .from("referral_codes")
        .select("user_id")
        .eq("code", referralCode)
        .maybeSingle();

      if (referrerCode) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await supabaseAdmin.from("referrals").insert({
          referrer_id: referrerCode.user_id,
          referee_id: authData.user.id,
          referral_code: referralCode,
          status: "pending",
          referee_completed_jobs: 0,
          reward_amount: 100.00,
          expires_at: expiresAt.toISOString(),
        }).then(({ error }) => {
          if (error) console.error("[ridechecker/register] Referral insert error:", error.message);
        });
      }
    }

    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: authData.user.id,
      actor_email: email,
      actor_roles: "ridechecker",
      action: "ridechecker.signup",
      resource_id: authData.user.id,
      new_value: {
        email,
        service_area: serviceArea || null,
        experience: experience || null,
        referral_code_used: referralCode || null,
        own_referral_code: myReferralCode,
      },
    }).then(({ error }) => {
      if (error) console.error("[ridechecker/register] Audit log error:", error.message);
    });

    return NextResponse.json({
      success: true,
      message: "RideChecker account created. You can now sign in.",
    });
  } catch (err: any) {
    console.error("[ridechecker/register] Unexpected error:", err?.message);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
