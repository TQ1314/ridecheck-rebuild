import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "./email";

export interface NewOrderNotification {
  id: string;
  created_at: string;
  buyer_email: string;
  buyer_phone?: string | null;
  vehicle_year: number;
  vehicle_make: string;
  vehicle_model: string;
  package: string;
  final_price: number;
  booking_type: string;
  seller_name?: string | null;
  seller_phone?: string | null;
  seller_type?: string | null;
  inspection_address?: string | null;
  vehicle_location?: string | null;
  preferred_date?: string | null;
}

/** An informational alert only; failure must never turn an unpaid request into fulfillment. */
export async function notifyNewOrderRequest(order: NewOrderNotification): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .in("role", ["operations", "operations_lead", "ops_lead", "owner"])
    .eq("is_active", true);
  if (error) throw error;
  const recipients = new Set((data ?? []).map((profile) => profile.email).filter(Boolean));
  if (process.env.ADMIN_EMAIL) recipients.add(process.env.ADMIN_EMAIL);
  if (recipients.size === 0) {
    console.error("[order created ops] No active Ops email recipients configured", { orderId: order.id });
    return;
  }
  const lines = [
    "PENDING PAYMENT / NOT ACTIONABLE — no seller outreach or dispatch",
    `Order ID: ${order.id}`,
    `Created: ${order.created_at}`,
    `Customer name: Not provided`,
    `Customer email: ${order.buyer_email}`,
    `Customer phone: ${order.buyer_phone || "Not provided"}`,
    `Vehicle: ${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`,
    `Package: ${order.package}`,
    `Amount requested: $${Number(order.final_price).toFixed(2)}`,
    `Service: ${order.booking_type === "concierge" ? "Concierge" : "Self-Arrange"}`,
    `Seller/dealer: ${order.seller_name || "Not provided"} (${order.seller_type || "Not provided"})`,
    `Seller phone: ${order.seller_phone || "Not provided"}`,
    `Inspection location: ${order.inspection_address || order.vehicle_location || "Not provided"}`,
    `Requested date: ${order.preferred_date || "Not provided"}`,
    "Payment state: UNPAID",
  ];
  const escape = (s: string) => s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const html = `<div style="font-family:sans-serif">${lines.map((line) => `<p>${escape(line)}</p>`).join("")}</div>`;
  const results = await Promise.allSettled([...recipients].map(async (to) => {
    const result = await sendEmail({
      to,
      subject: `RideCheck request created — PENDING PAYMENT — ${order.id}`,
      html,
    });
    if (!result.success) throw new Error("Email provider did not accept Ops notification");
  }));
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[order created ops] notification failed", { orderId: order.id, error: result.reason });
    }
  }
}