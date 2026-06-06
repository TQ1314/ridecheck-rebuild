import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("ridecheck_credits")
      .select("supporter_name, created_at")
      .eq("list_on_partners_page", true)
      .eq("session_type", "founding_supporter")
      .in("status", ["active", "redeemed"])
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ partners: [] });
    }

    const partners = (data ?? []).map((row) => {
      const parts    = (row.supporter_name ?? "").trim().split(/\s+/);
      const first    = parts[0] ?? "";
      const lastInit = parts.length > 1
        ? parts[parts.length - 1].charAt(0).toUpperCase() + "."
        : "";
      const display = lastInit ? `${first} ${lastInit}` : first;
      const month   = new Date(row.created_at).toLocaleDateString("en-US", {
        month: "long", year: "numeric",
      });
      return { display, month };
    });

    return NextResponse.json({ partners });
  } catch (err) {
    console.error("[founding/partners]", err);
    return NextResponse.json({ partners: [] });
  }
}
