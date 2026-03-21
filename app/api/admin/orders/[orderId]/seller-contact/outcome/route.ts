import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

const outcomeSchema = z.object({
  outcome: z.enum(["accepted", "declined", "no_response", "invalid_contact"]),
  notes: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = outcomeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { outcome, notes } = parsed.data;

    if (outcome === "no_response") {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("booking_type, seller_contact_attempts")
        .eq("id", params.orderId)
        .single();

      if (order?.booking_type === "concierge" && (order.seller_contact_attempts || 0) < 3) {
        return NextResponse.json(
          { error: "Concierge orders require at least 3 contact attempts before marking no_response" },
          { status: 400 },
        );
      }
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        seller_contact_status: outcome,
        seller_outcome_notes: notes || null,
        updated_at: now,
      })
      .eq("id", params.orderId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    const details: Record<string, any> = {
      outcome,
      ...(notes ? { notes } : {}),
    };

    await Promise.all([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "seller_contact_outcome",
        actorId: actor.userId,
        actorEmail: actor.email,
        details,
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.seller_contact_outcome",
        resourceId: params.orderId,
        newValue: details,
      }),
    ]);

    return NextResponse.json({
      success: true,
      seller_contact_status: outcome,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
