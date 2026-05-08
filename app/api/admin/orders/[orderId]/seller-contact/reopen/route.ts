import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

const schema = z.object({
  reason: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    const reason = parsed.success ? (parsed.data.reason || null) : null;

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        seller_contact_status: "attempting",
        seller_outcome_notes: null,
        updated_at: now,
      })
      .eq("id", params.orderId);

    if (updateError) {
      console.error("[seller-contact/reopen] update error", updateError);
      return NextResponse.json({ error: "Failed to reopen seller outreach" }, { status: 500 });
    }

    const details: Record<string, any> = { reopened_by: actor.email };
    if (reason) details.reason = reason;

    await Promise.all([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "seller_outreach_reopened",
        actorId: actor.userId,
        actorEmail: actor.email,
        details,
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.seller_outreach_reopened",
        resourceId: params.orderId,
        newValue: details,
      }),
    ]);

    return NextResponse.json({ success: true, seller_contact_status: "attempting" });
  } catch (err: any) {
    console.error("[seller-contact/reopen] unexpected error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
