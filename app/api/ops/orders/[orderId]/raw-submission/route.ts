import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;

    const [{ data, error }, { data: assignmentData, error: assignmentError }] = await Promise.all([
      supabaseAdmin
        .from("ridechecker_raw_submissions")
        .select("*")
        .eq("order_id", params.orderId),
      supabaseAdmin
        .from("ridechecker_job_assignments")
        .select("*")
        .eq("order_id", params.orderId),
    ]);

    if (error || assignmentError) {
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }

    return NextResponse.json({
      submission: data[0] || null,
      assignment: assignmentData[0] || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
