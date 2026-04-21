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
  "/careers",
  "/join",
  "/terms",
  "/privacy",
  "/inspection-disclaimer",
  "/customer-agreement",
  "/contractor-agreement",
  "/contact",
  "/faq",
  "/what-we-check",
  "/seller",
  "/blog",
];

const INVITE_PREFIX = "/invite/";
const TRACK_PREFIX = "/track/";
const PAY_PREFIX = "/pay/";

// Requests that must never enter the middleware auth logic
const SKIP_PREFIXES = ["/_next", "/api", "/favicon", "/images", "/fonts", "/videos"];

const ES_PREFIX = "/es";

function isPublic(pathname: string) {
  return (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith(INVITE_PREFIX) ||
    pathname.startsWith(TRACK_PREFIX) ||
    pathname.startsWith(PAY_PREFIX) ||
    pathname === ES_PREFIX ||
    pathname.startsWith(`${ES_PREFIX}/`) ||
    pathname.startsWith("/blog")
  );
}

function isStaticOrInternal(pathname: string) {
  if (pathname.includes(".")) return true;
  return SKIP_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Never touch static assets, API routes, or internal Next.js paths
  if (isStaticOrInternal(pathname)) return NextResponse.next();

  // Public pages need no session check — return immediately
  if (isPublic(pathname)) return NextResponse.next();

  // For all protected routes: one fast cookie-based session read.
  // No DB call — role enforcement lives in the route/page handlers via rbac.ts.
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
