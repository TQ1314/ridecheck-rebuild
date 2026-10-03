export type JourneyOrder = {
  order_number: string | null;
  booking_type: string | null;
  listing_source: string | null;
  platform_source?: string | null;
  facebook_consent_reported?: boolean;
  payment_status: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
};

export function isFacebookBuyerHandoff(order: Pick<JourneyOrder, "platform_source" | "facebook_consent_reported"> | null): boolean {
  return order?.platform_source === "facebook_marketplace" && order.facebook_consent_reported === true;
}

export function publicOrderReference(orderNumber: string | null | undefined): string | null {
  return orderNumber ? `Order #${orderNumber}` : null;
}

export function isSelfArranged(type: string | null | undefined): boolean {
  return type === "self_arrange" || type === "buyer_arranged";
}

export function isMarketplaceConcierge(order: Pick<JourneyOrder, "booking_type" | "listing_source">): boolean {
  return order.booking_type === "concierge" && order.listing_source === "online_marketplace";
}

export function sellerIntroduction(vehicle: Pick<JourneyOrder, "vehicle_year" | "vehicle_make" | "vehicle_model">): string {
  const label = [vehicle.vehicle_year, vehicle.vehicle_make, vehicle.vehicle_model]
    .filter((part) => part != null && String(part).trim())
    .join(" ");
  return `Hi,

I'm interested in ${label ? `the ${label}` : "the vehicle"} and would like to move forward. Before making a purchase decision, I'd like to have a pre-purchase inspection completed first.

I've arranged for RideCheck to perform an independent inspection. Their team will handle the scheduling from here, so you may hear from them shortly to coordinate access to the vehicle.

Please let me know if that works for you. I appreciate your time and look forward to hearing from you.

Thanks!`;
}

export const SELF_ARRANGE_MESSAGE = "Hi! I'm arranging a RideCheck pre-purchase inspection. Could you confirm when and where an inspector can access the vehicle? I will coordinate the time with you and share the details with RideCheck. Thanks!";

export const PURCHASE_DECISION_ACKNOWLEDGMENT = "I understand the RideCheck report is one source of information to help me make an informed purchase decision, and the final purchase decision remains mine.";