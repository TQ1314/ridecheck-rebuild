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
];

const SKIP_PREFIXES = ["/_next", "/api", "/favicon", "/images", "/fonts"];

// If you support locales in your app, keep this in sync with your i18n setup
const LOCALES = ["en", "es", "fr"];
const DEFAULT_LOCALE = "en";

/**
 * Strip locale prefix from pathname so route checks work for:
 * /admin  AND /en/admin  AND /fr/admin
 */
function stripLocale(pathname: string) {
  for (const loc of LOCALES) {
    if (pathname === `/${loc}`) return "/";
    if (pathname.startsWith(`/${loc}/`)) return pathname.slice(loc.length + 1);
  }
  return pathname;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Skip static assets / internal routes
  for (const prefix of SKIP_PREFIXES) {
    if (pathname.startsWith(prefix)) return NextResponse.next();
  }

  // Skip files like /robots.txt, /sitemap.xml, etc.
  if (pathname.includes(".")) return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createMiddlewareSupabaseClient(req, res);

  // Normalize path for auth + RBAC checks (handles /en/*)
  const normalizedPath = stripLocale(pathname);

  // Get session
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.log("MIDDLEWARE session error:", sessionError);
  }

  // Allow public routes without session
  if (PUBLIC_ROUTES.includes(normalizedPath)) {
    return res;
  }

  // Require auth for all other routes
  if (!session) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("redirect", `${pathname}${search || ""}`); // keep original (with locale)
    return NextResponse.redirect(loginUrl);
  }

  // Load profile (role + is_active)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.user.id)
    .maybeSingle();

  // If middleware cannot read profiles due to RLS, do NOT call it deactivated.
  if (profileError) {
    console.log("MIDDLEWARE profile read error:", profileError);

    await supabase.auth.signOut();
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("error", "profile_read_failed");
    loginUrl.searchParams.set("redirect", `${pathname}${search || ""}`);
    return NextResponse.redirect(loginUrl);
  }

  // No profile row found (common when profile not created yet)
  if (!profile) {
    console.log("MIDDLEWARE: profile missing for user:", session.user.id);

    await supabase.auth.signOut();
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("error", "profile_missing");
    loginUrl.searchParams.set("redirect", `${pathname}${search || ""}`);
    return NextResponse.redirect(loginUrl);
  }

  // Profile exists but inactive
  if (!profile.is_active) {
    await supabase.auth.signOut();
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("error", "deactivated");
    loginUrl.searchParams.set("redirect", `${pathname}${search || ""}`);
    return NextResponse.redirect(loginUrl);
  }

  const role = profile.role;

  // Role gates (use normalizedPath so /en/admin works)
  if (normalizedPath.startsWith("/admin")) {
    if (["owner", "operations", "operations_lead"].includes(role)) return res;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (normalizedPath.startsWith("/operations")) {
    if (["operations", "operations_lead", "owner"].includes(role)) return res;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (normalizedPath.startsWith("/platform")) {
    if (["platform", "owner"].includes(role)) return res;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (normalizedPath.startsWith("/qa")) {
    if (["qa", "owner"].includes(role)) return res;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (normalizedPath.startsWith("/dev")) {
    if (["developer", "owner"].includes(role)) return res;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
