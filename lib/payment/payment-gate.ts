export interface PaymentGateOrder {
  payment_status: string | null;
  payment_required?: boolean | null;
  payment_override_approved?: boolean | null;
}

/**
 * Returns true if field work (seller outreach, RC assignment, inspection,
 * report generation, buyer delivery) is authorized for this order.
 *
 * Passes when:
 *   - payment_required is explicitly false (test / internal orders)
 *   - payment_status is "paid" (Stripe webhook confirmed)
 *   - payment_status is "paid_manual_verified" (manual payment verification)
 *   - payment_override_approved is true AND payment_status is "override_approved"
 *     (approved by ops_lead / admin / owner)
 */
export function canProceedWithRideCheck(order: PaymentGateOrder): boolean {
  if (order.payment_required === false) return true;
  if (order.payment_status === "paid") return true;
  if (order.payment_status === "paid_manual_verified") return true;
  if (
    order.payment_override_approved === true &&
    order.payment_status === "override_approved"
  ) return true;
  return false;
}

export const PAYMENT_GATE_ERRORS = {
  seller_outreach:   "Payment is required before seller outreach can begin.",
  assignment:        "Payment is required before assigning a RideChecker.",
  inspection_start:  "Payment is required before starting an inspection.",
  report_generation: "Payment is required before report generation.",
  report_delivery:   "Payment is required before report delivery.",
} as const;
