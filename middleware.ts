import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase/middleware";

const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/how-it-works",
  "/book",
  "/order/received",
  "/order/confirmation",
  "/auth/login",
  "/auth/register",
  "/auth/callback",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/ridechecker/signup",
];

const INVITE_PREFIX = "/invite/";

const SKIP_PREFIXES = ["/_next", "/api", "/favicon", "/images", "/fonts"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  for (const prefix of SKIP_PREFIXES) {
    if (pathname.startsWith(prefix)) return NextResponse.next();
  }

  if (pathname.includes(".")) return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createMiddlewareSupabaseClient(req, res);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) console.log("MIDDLEWARE session error:", sessionError);

  if (PUBLIC_ROUTES.includes(pathname) || pathname.startsWith(INVITE_PREFIX)) return res;

  if (!session) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("redirect", `${pathname}${search || ""}`);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.user.id)
    .maybeSingle();

  // Key change: do NOT signOut here. Preserve session so we can recover after DB fix.
  if (profileError) {
    console.log("MIDDLEWARE profile read error:", profileError);
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("error", "profile_read_failed");
    loginUrl.searchParams.set("redirect", `${pathname}${search || ""}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!profile) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("error", "profile_missing");
    loginUrl.searchParams.set("redirect", `${pathname}${search || ""}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!profile.is_active) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("error", "deactivated");
    loginUrl.searchParams.set("redirect", `${pathname}${search || ""}`);
    return NextResponse.redirect(loginUrl);
  }

  const role = profile.role;

  if (pathname.startsWith("/admin")) {
    if (["owner", "operations", "operations_lead"].includes(role)) return res;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname.startsWith("/operations")) {
    if (["operations", "operations_lead", "owner"].includes(role)) return res;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname.startsWith("/inspector")) {
    if (["inspector", "owner"].includes(role)) return res;
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

  if (pathname.startsWith("/ridechecker/") && pathname !== "/ridechecker/signup") {
    if (["ridechecker", "ridechecker_active", "owner"].includes(role)) return res;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    if (["ridechecker", "ridechecker_active"].includes(role)) {
      return NextResponse.redirect(new URL("/ridechecker/dashboard", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
