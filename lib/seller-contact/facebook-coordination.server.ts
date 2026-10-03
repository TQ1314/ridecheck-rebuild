import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeOrderEvent } from "@/lib/rbac";

/** Called only after an existing payment-gated Ops action. Historical orders are untouched. */
export async function recordFacebookCoordinationStarted(orderId: string, actorId: string, actorEmail: string) {
  try {
    const { data: events, error } = await supabaseAdmin.from("order_events")
      .select("event_type,details")
      .eq("order_id", orderId)
      .in("event_type", ["seller_consent_reported", "seller_coordination_started"]);
    if (error) throw error;
    const rows = (events ?? []) as any[];
    if (!rows.some((event) => event.event_type === "seller_consent_reported" &&
      event.details?.source === "facebook_marketplace") ||
      rows.some((event) => event.event_type === "seller_coordination_started")) return;
    await writeOrderEvent({
      orderId, actorId, actorEmail, eventType: "seller_coordination_started",
      details: { source: "facebook_marketplace", origin: "existing_ops_seller_workflow", payment_gate_passed: true },
      isInternal: true,
    });
  } catch (error) {
    console.error("[Facebook coordination event]", { orderId, error });
  }
}