import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

const contactSchema = z.object({
  notes: z.string().optional(),
  contact_method: z.enum(["phone", "email", "sms", "other"]).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json().catch(() => ({}));
    const parsed = contactSchema.safeParse(body);

    const { data: currentOrder } = await supabaseAdmin
      .from("orders")
      .select("seller_contact_attempts, seller_contacted_at")
      .eq("id", params.orderId)
      .single();

    if (!currentOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const newAttempts = (currentOrder.seller_contact_attempts || 0) + 1;
    const now = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      seller_contact_attempts: newAttempts,
      updated_at: now,
    };

    if (!currentOrder.seller_contacted_at) {
      updatePayload.seller_contacted_at = now;
    }

    if (newAttempts === 1) {
      updatePayload.ops_status = "seller_outreach";
    }

    const { error } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", params.orderId);

    if (error) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    const details: Record<string, any> = {
      attempt_number: newAttempts,
      ...(parsed.data?.contact_method ? { method: parsed.data.contact_method } : {}),
      ...(parsed.data?.notes ? { notes: parsed.data.notes } : {}),
    };

    await Promise.all([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "seller_contacted",
        actorId: actor.userId,
        actorEmail: actor.email,
        details,
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.seller_contacted",
        resourceId: params.orderId,
        newValue: { seller_contact_attempts: newAttempts, ...details },
      }),
    ]);

    return NextResponse.json({
      success: true,
      seller_contact_attempts: newAttempts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
