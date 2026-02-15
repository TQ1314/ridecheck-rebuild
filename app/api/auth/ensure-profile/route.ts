import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const INTERNAL_SECRET = process.env.SESSION_SECRET;

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("x-internal-secret");
    if (!INTERNAL_SECRET || authHeader !== INTERNAL_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({
        profile: existingProfile,
        created: false,
      });
    }

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (!authUser?.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: newProfile, error: insertError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: authUser.user.email || "",
          full_name:
            authUser.user.user_metadata?.full_name ||
            authUser.user.email?.split("@")[0] ||
            "User",
          phone: authUser.user.user_metadata?.phone || null,
          role: "customer",
          is_active: true,
        },
        { onConflict: "id" }
      )
      .select("id, role")
      .single();

    if (insertError) {
      console.error("ensure-profile insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      profile: newProfile,
      created: true,
    });
  } catch (err: any) {
    console.error("ensure-profile error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
