/**
 * lib/seller-contact/partyDetector.ts
 *
 * Determines whether an inbound email sender is a seller, buyer, or RideChecker
 * for a given matched order, so we can set sender_type on seller_messages rows.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export type SenderParty = "seller" | "buyer" | "ridechecker" | "unknown";

function normalizeEmail(e: string): string {
  return (e ?? "").toLowerCase().trim();
}

/**
 * Given a matched order + inbound from_address, return the sender party.
 * Priority: seller → buyer → ridechecker → unknown
 */
export async function detectInboundParty(params: {
  fromAddress: string;
  orderId: string;
}): Promise<SenderParty> {
  const from = normalizeEmail(params.fromAddress);
  if (!from) return "unknown";

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(
      "seller_email, buyer_email, customer_email, assigned_ridechecker_id"
    )
    .eq("id", params.orderId)
    .maybeSingle();

  if (!order) return "unknown";

  // 1. Seller match
  if (order.seller_email && normalizeEmail(order.seller_email) === from) {
    return "seller";
  }

  // 2. Buyer match (try both buyer_email and customer_email fields)
  const buyerEmail =
    normalizeEmail(order.buyer_email ?? "") ||
    normalizeEmail(order.customer_email ?? "");
  if (buyerEmail && buyerEmail === from) {
    return "buyer";
  }

  // 3. RideChecker match — check assigned RC's email
  if (order.assigned_ridechecker_id) {
    const { data: rc } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", order.assigned_ridechecker_id)
      .maybeSingle();
    if (rc && normalizeEmail((rc as any).email ?? "") === from) {
      return "ridechecker";
    }
  }

  // 4. Broader RC scan — from_address matches any ridechecker in profiles
  //    (catches replies from RCs who are not currently assigned)
  const { data: rcMatch } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", from)
    .eq("role", "ridechecker")
    .limit(1)
    .maybeSingle();
  if (rcMatch) return "ridechecker";

  return "unknown";
}
