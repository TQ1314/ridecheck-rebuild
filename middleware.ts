import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase/middleware";

// Public paths that fall under protected prefixes but need no auth
const PUBLIC_EXCEPTIONS = ["/ridechecker/signup"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PUBLIC_EXCEPTIONS.includes(pathname)) return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createMiddlewareSupabaseClient(req, res);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const url = new URL("/auth/login", req.url);
    url.searchParams.set("redirect", `${pathname}${search || ""}`);
    url.searchParams.set("error", "login_required");
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/ridechecker/:path*",
    "/ops/:path*",
    "/qa/:path*",
  ],
};
