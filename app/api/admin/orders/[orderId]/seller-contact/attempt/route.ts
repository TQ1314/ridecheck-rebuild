import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

const attemptSchema = z.object({
  channel: z.string(),
  destination: z.string().optional(),
  message_template_key: z.string().optional(),
  message_body: z.string().optional(),
  status: z.enum(["sent", "failed"]).optional().default("sent"),
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
    const parsed = attemptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { channel, destination, message_template_key, message_body, status } = parsed.data;

    let attemptNumber = 1;
    if (channel !== "buyer_message") {
      const { data: maxAttempt } = await supabaseAdmin
        .from("seller_contact_attempts")
        .select("attempt_number")
        .eq("order_id", params.orderId)
        .neq("channel", "buyer_message")
        .order("attempt_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      attemptNumber = (maxAttempt?.attempt_number || 0) + 1;
    }

    const { error: insertError } = await supabaseAdmin
      .from("seller_contact_attempts")
      .insert({
        order_id: params.orderId,
        attempt_number: attemptNumber,
        channel,
        destination: destination || null,
        message_template_key: message_template_key || null,
        message_body: message_body || null,
        status,
        created_by: actor.userId,
      });

    if (insertError) {
      return NextResponse.json({ error: "Failed to insert attempt" }, { status: 500 });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      updated_at: now,
    };

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("seller_contact_attempts, seller_contact_status, seller_last_contact_at")
      .eq("id", params.orderId)
      .single();

    if (channel !== "buyer_message") {
      updatePayload.seller_contact_attempts = (order?.seller_contact_attempts || 0) + 1;
      updatePayload.seller_last_contact_at = now;
    }

    if (!order?.seller_contact_status || order.seller_contact_status === "not_started") {
      updatePayload.seller_contact_status = "attempting";
    }

    if (channel === "buyer_message" && message_body?.toLowerCase().includes("confirmed")) {
      updatePayload.seller_contact_status = "accepted";
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", params.orderId);

    if (updateError) {
      console.error("[seller-contact attempt] order update error", updateError);
    }

    const details: Record<string, any> = {
      attempt_number: attemptNumber,
      channel,
      status,
      ...(destination ? { destination } : {}),
    };

    await Promise.all([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "seller_contact_attempt",
        actorId: actor.userId,
        actorEmail: actor.email,
        details,
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.seller_contact_attempt",
        resourceId: params.orderId,
        newValue: details,
      }),
    ]);

    return NextResponse.json({
      success: true,
      attempt_number: attemptNumber,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
