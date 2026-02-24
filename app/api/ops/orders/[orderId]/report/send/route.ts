import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized, writeOrderEvent } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        report_status: "sent",
        report_sent_at: now,
        updated_at: now,
      })
      .eq("id", params.orderId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    await writeOrderEvent({
      orderId: params.orderId,
      eventType: "report_sent",
      actorId: actor.userId,
      actorEmail: actor.email,
      details: { sent_at: now },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
