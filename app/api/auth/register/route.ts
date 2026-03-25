import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_NAME_LEN = 120;
const MAX_EMAIL_LEN = 254;
const MAX_PHONE_LEN = 30;
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 128;

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
      console.error("[register] Auth error:", authError.message);
      return NextResponse.json(
        { error: "Failed to create account. Please try again." },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    // Role is ALWAYS hardcoded to "customer" — never read from the request body
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: authData.user.id,
          email,
          full_name: fullName,
          phone: phone || null,
          role: "customer",        // ← hardcoded, cannot be overridden by caller
          is_active: true,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      console.error("[register] Profile error:", profileError.message);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: "Failed to set up your account. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Account created successfully. You can now sign in.",
    });
  } catch (err: any) {
    console.error("[register] Unexpected error:", err?.message);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
