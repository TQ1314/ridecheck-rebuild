import { NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await requireRole(["admin", "owner", "operations_lead"]);
  if (!isAuthorized(result)) return result.error;

  const { data: credits, error } = await supabaseAdmin
    .from("ridecheck_credits")
    .select("*")
    .eq("session_type", "founding_supporter")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }

  const cols = [
    "id", "tier", "amount_cents", "credits_count", "credit_code",
    "supporter_name", "supporter_email", "supporter_phone",
    "gift_recipient_name", "gift_recipient_email",
    "list_on_partners_page", "status", "expires_at", "created_at",
  ] as const;

  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = (credits ?? []).map((r) =>
    cols.map((c) => escape((r as Record<string, unknown>)[c])).join(",")
  );
  const csv = [cols.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type":        "text/csv",
      "Content-Disposition": `attachment; filename="founding-supporters-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
