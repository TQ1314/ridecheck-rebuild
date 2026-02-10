import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase/middleware";

const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/how-it-works",
  "/book",
  "/order/received",
  "/auth/login",
  "/auth/register",
  "/auth/callback",
];

const SKIP_PREFIXES = ["/_next", "/api", "/favicon", "/images", "/fonts"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  for (const prefix of SKIP_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return NextResponse.next();
    }
  }

  if (pathname.includes(".")) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareSupabaseClient(req, res);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (PUBLIC_ROUTES.includes(pathname)) {
    return res;
  }

  if (!session) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.user.id)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("error", "deactivated");
    return NextResponse.redirect(loginUrl);
  }

  const role = profile.role;

  if (pathname.startsWith("/admin")) {
    if (role === "owner") return res;
    if (["operations", "operations_lead"].includes(role)) {
      return NextResponse.redirect(new URL("/operations", req.url));
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname.startsWith("/operations")) {
    if (["operations", "operations_lead", "owner"].includes(role)) return res;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname.startsWith("/platform")) {
    if (["platform", "owner"].includes(role)) return res;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname.startsWith("/qa")) {
    if (["qa", "owner"].includes(role)) return res;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname.startsWith("/dev")) {
    if (["developer", "owner"].includes(role)) return res;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
