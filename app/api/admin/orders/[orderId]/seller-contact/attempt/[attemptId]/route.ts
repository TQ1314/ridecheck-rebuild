import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  response_received: z.boolean(),
  response_notes: z.string().max(1000).optional(),
});

// PATCH — record a seller reply on a specific contact attempt
export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string; attemptId: string } }
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const { response_received, response_notes } = parsed.data;
    const now = new Date().toISOString();

    // Verify the attempt belongs to this order
    const { data: attempt, error: fetchErr } = await supabaseAdmin
      .from("seller_contact_attempts")
      .select("id, order_id, channel, attempt_number")
      .eq("id", params.attemptId)
      .eq("order_id", params.orderId)
      .maybeSingle();

    if (fetchErr || !attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const { error: updateErr } = await supabaseAdmin
      .from("seller_contact_attempts")
      .update({
        response_received,
        response_at: response_received ? now : null,
        response_notes: response_notes ?? null,
      })
      .eq("id", params.attemptId);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to update attempt" }, { status: 500 });
    }

    // If response received, update overall seller contact status to "accepted" if not already closed
    if (response_received) {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("seller_contact_status")
        .eq("id", params.orderId)
        .maybeSingle();

      if (order && !["accepted", "declined", "invalid_contact"].includes(order.seller_contact_status ?? "")) {
        await supabaseAdmin
          .from("orders")
          .update({ seller_contact_status: "accepted", updated_at: now })
          .eq("id", params.orderId);
      }
    }

    await writeOrderEvent({
      orderId: params.orderId,
      eventType: "seller_response_recorded",
      actorId: actor.userId,
      actorEmail: actor.email,
      details: {
        attempt_id: params.attemptId,
        attempt_number: attempt.attempt_number,
        channel: attempt.channel,
        response_received,
        response_notes: response_notes ?? null,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[seller-contact attempt response error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
