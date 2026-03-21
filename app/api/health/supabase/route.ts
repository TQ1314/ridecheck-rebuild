import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({
      ok: false,
      error: "Missing Supabase env vars in Replit Secrets.",
      connectivity: false,
      write: false,
    });
  }

  const hasServiceRole = !!serviceRoleKey;

  let connectivity = false;
  let connectivityError: string | null = null;
  let write = false;
  let writeError: string | null = null;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      supabaseUrl,
      hasServiceRole ? serviceRoleKey! : supabaseAnonKey,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    const { error: selectError } = await client
      .from("health_pings")
      .select("id")
      .limit(1);

    if (selectError) {
      if (
        selectError.message.includes("does not exist") ||
        selectError.message.includes("schema cache") ||
        selectError.code === "42P01"
      ) {
        connectivity = true;
        connectivityError =
          "Table 'health_pings' does not exist yet. Run the migration SQL in /supabase/migrations/ first. Supabase connectivity is confirmed.";
      } else if (selectError.code === "42501" || selectError.message.includes("permission")) {
        connectivity = true;
        connectivityError =
          "Connected but RLS blocks reads. Add service role key or apply RLS policy.";
      } else {
        connectivityError = selectError.message;
      }
    } else {
      connectivity = true;
    }

    if (connectivity) {
      const { error: insertError } = await client
        .from("health_pings")
        .insert({ pinged_at: new Date().toISOString() });

      if (insertError) {
        if (insertError.code === "42501" || insertError.message.includes("permission")) {
          writeError = hasServiceRole
            ? "Service role insert blocked by RLS. Check policy."
            : "No service role key. Add SUPABASE_SERVICE_ROLE_KEY to Replit Secrets, or apply this RLS policy:\n\nCREATE POLICY \"allow_health_pings_insert\" ON health_pings FOR INSERT WITH CHECK (true);";
        } else if (
          insertError.message.includes("does not exist") ||
          insertError.code === "42P01"
        ) {
          writeError =
            "Table 'health_pings' does not exist. Run the migration SQL first.";
        } else {
          writeError = insertError.message;
        }
      } else {
        write = true;
      }
    }
  } catch (err: any) {
    connectivityError = err.message || "Unknown connection error";
  }

  return NextResponse.json({
    ok: connectivity && write,
    connectivity,
    write,
    using_service_role: hasServiceRole,
    ...(connectivityError ? { connectivity_error: connectivityError } : {}),
    ...(writeError ? { write_error: writeError } : {}),
    timestamp: new Date().toISOString(),
  });
}
