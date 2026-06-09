import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SELLER_STATUSES = [
  "awaiting",
  "seller_not_contacted",
  "seller_contacted",
  "awaiting_seller_response",
  "seller_confirmed",
  "seller_reschedule_requested",
  "seller_declined",
  "seller_no_response",
  "vehicle_sold",
  "unsafe_location_flagged",
  "confirmed",
  "no_response",
  "invalid",
  // Facebook Marketplace buyer-bridge workflow statuses
  "facebook_seller_approval_pending",
  "facebook_seller_approved",
  "facebook_seller_declined",
  "facebook_contact_info_needed",
] as const;

const schema = z.object({
  seller_status: z.enum(SELLER_STATUSES),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid seller_status" }, { status: 400 });
    }

    const { seller_status } = parsed.data;
    const now = new Date().toISOString();

    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({ seller_status, updated_at: now })
      .eq("id", params.orderId);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to update seller status" }, { status: 500 });
    }

    await Promise.allSettled([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "seller_status_updated",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: { seller_status },
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.seller_status_updated",
        resourceId: params.orderId,
        newValue: { seller_status },
      }),
    ]);

    return NextResponse.json({ success: true, seller_status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
