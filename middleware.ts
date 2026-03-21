// middleware.ts (ROOT)
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
  "/before-you-buy",
  "/ridechecker/signup",
  "/join",
  "/terms",
  "/privacy",
  "/contact",
  "/faq",
  "/what-we-check",
  "/seller",
  "/blog",
];

const INVITE_PREFIX = "/invite/";

const TRACK_PREFIX = "/track/";
const PAY_PREFIX = "/pay/";

const SKIP_PREFIXES = ["/_next", "/api", "/favicon", "/images", "/fonts"];

const STAFF_PREFIXES = ["/admin", "/dashboard", "/operations", "/qa", "/dev", "/platform"];

const STAFF_ROLES = [
  "owner",
  "admin",
  "operations",
  "operations_lead",
  "ops",
  "qa",
  "developer",
  "platform",
  "inspector",
];

const ES_PREFIX = "/es";

function isPublic(pathname: string) {
  return PUBLIC_ROUTES.includes(pathname) || pathname.startsWith(INVITE_PREFIX) || pathname.startsWith(TRACK_PREFIX) || pathname.startsWith(PAY_PREFIX) || pathname === ES_PREFIX || pathname.startsWith(`${ES_PREFIX}/`) || pathname.startsWith("/blog");
}

function isStaticOrInternal(pathname: string) {
  if (pathname.includes(".")) return true;
  return SKIP_PREFIXES.some((p) => pathname.startsWith(p));
}

function isStaffRoute(pathname: string) {
  return STAFF_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isStaticOrInternal(pathname)) return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createMiddlewareSupabaseClient(req, res);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (isPublic(pathname)) return res;

  if (isStaffRoute(pathname)) {
    if (!session) {
      const url = new URL("/auth/login", req.url);
      url.searchParams.set("redirect", `${pathname}${search || ""}`);
      url.searchParams.set("error", "login_required");
      return NextResponse.redirect(url);
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !profile || !profile.is_active) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (!STAFF_ROLES.includes(profile.role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      if (["ridechecker", "ridechecker_active"].includes(profile.role)) {
        return NextResponse.redirect(new URL("/ridechecker/dashboard", req.url));
      }
    }

    return res;
  }

  if (pathname.startsWith("/ridechecker/") && pathname !== "/ridechecker/signup") {
    if (!session) {
      const url = new URL("/auth/login", req.url);
      url.searchParams.set("redirect", `${pathname}${search || ""}`);
      url.searchParams.set("error", "login_required");
      return NextResponse.redirect(url);
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !profile || !profile.is_active) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (!["ridechecker", "ridechecker_active", "owner"].includes(profile.role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return res;
  }

  if (!session) {
    const url = new URL("/auth/login", req.url);
    url.searchParams.set("redirect", `${pathname}${search || ""}`);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
