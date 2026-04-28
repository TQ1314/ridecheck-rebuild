// lib/app-url.ts
// Single source of truth for the canonical application URL used in all emails,
// SMS, and server-side link generation.
//
// Priority order:
//   1. RIDECHECKAUTO_DOMAIN  — explicit production override (set this in production)
//   2. NEXT_PUBLIC_APP_URL   — general app URL env var
//   3. Hard-coded fallback   — www.ridecheckauto.com
//
// IMPORTANT: Never use NEXT_PUBLIC_APP_URL directly in server routes that build
// email or SMS links. Use this helper so all routes stay in sync.

export function getAppUrl(): string {
  const url =
    process.env.RIDECHECKAUTO_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://www.ridecheckauto.com";

  // Strip trailing slash so callers can safely do `${getAppUrl()}/path`
  return url.replace(/\/$/, "");
}
