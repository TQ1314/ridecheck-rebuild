import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const envChecks = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
  };

  const missingCritical =
    !envChecks.NEXT_PUBLIC_SUPABASE_URL ||
    !envChecks.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return NextResponse.json({
    ok: !missingCritical,
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    env: envChecks,
    ...(missingCritical
      ? { error: "Missing Supabase env vars in Replit Secrets." }
      : {}),
  });
}
