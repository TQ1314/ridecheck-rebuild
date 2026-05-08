import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS = [
  "ridechecker_notified",
  "task_created",
  "task_reassigned",
  "escalation_sent",
  "inspection_completed_notice",
] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const result = await requireRole(["owner", "operations_lead", "ops_lead", "operations", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const { orderId } = params;

  // Fetch logs for this order
  const { data: logs, error: logsError } = await supabaseAdmin
    .from("connecteam_logs")
    .select("id, action, notes, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (logsError) {
    console.error("[connecteam GET logs error]", logsError);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }

  // Get the order to find assigned RC
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("assigned_ridechecker_id")
    .eq("id", orderId)
    .maybeSingle();

  let rcMapping = null;
  let rcName: string | null = null;

  if (order?.assigned_ridechecker_id) {
    const [profileRes, mappingRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", order.assigned_ridechecker_id)
        .maybeSingle(),
      supabaseAdmin
        .from("connecteam_mappings")
        .select("connecteam_name, connecteam_status")
        .eq("profile_id", order.assigned_ridechecker_id)
        .maybeSingle(),
    ]);

    rcName = profileRes.data?.full_name ?? null;
    rcMapping = mappingRes.data ?? null;
  }

  return NextResponse.json({ logs: logs ?? [], rc_mapping: rcMapping, rc_name: rcName });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const result = await requireRole(["owner", "operations_lead", "ops_lead", "operations", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const { orderId } = params;
  const body = await req.json().catch(() => ({}));
  const { action, notes } = body;

  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${ALLOWED_ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  // Get assigned RC for this order to record ridechecker_id
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("assigned_ridechecker_id")
    .eq("id", orderId)
    .maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("connecteam_logs")
    .insert({
      order_id: orderId,
      ridechecker_id: order?.assigned_ridechecker_id ?? null,
      action,
      notes: notes || null,
    })
    .select("id, action, notes, created_at")
    .single();

  if (error) {
    console.error("[connecteam POST error]", error);
    return NextResponse.json({ error: "Failed to log action" }, { status: 500 });
  }

  return NextResponse.json({ log: data });
}
