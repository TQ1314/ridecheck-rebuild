import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { NextResponse } from "next/server";
import { getDashboardPath, type Role } from "@/lib/utils/roles";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = createRouteHandlerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profile?.role) {
          const dashboardPath = getDashboardPath(profile.role as Role);
          return NextResponse.redirect(new URL(dashboardPath, requestUrl.origin));
        }
      }
    }
  }

  return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
}
