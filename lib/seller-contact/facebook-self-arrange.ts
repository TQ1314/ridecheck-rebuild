import { isFacebookMarketplaceListing } from "./facebook-marketplace";

type FacebookOrder = {
  booking_type?: string | null;
  booking_method?: string | null;
  listing_url?: string | null;
  platform_source?: string | null;
  seller_contact_status?: string | null;
  seller_available_date?: string | null;
  seller_available_time?: string | null;
  seller_inspection_address?: string | null;
};

export function resolveFacebookBookingType<T extends string>(facebook: boolean, selected: T): T | "self_arrange" {
  return facebook ? "self_arrange" : selected;
}

export function isFacebookSelfArrange(order: FacebookOrder): boolean {
  return order.booking_type === "self_arrange"
    && isFacebookMarketplaceListing(order.listing_url, order.platform_source);
}

/** Requested date, buyer-entered location, and reported consent are not confirmation.
 * These are the existing fields written by Ops' seller-confirm action.
 */
export function facebookAppointmentError(order: FacebookOrder): string | null {
  if (!isFacebookSelfArrange(order)) return null;
  const missing = order.seller_contact_status !== "confirmed" ? "seller contact confirmation"
    : !order.seller_available_date?.trim() ? "confirmed inspection date"
    : !order.seller_available_time?.trim() ? "confirmed inspection time"
    : !order.seller_inspection_address?.trim() ? "vehicle/inspection address"
    : null;
  return missing ? `Appointment not confirmed — missing ${missing}.` : null;
}

export const FACEBOOK_SELF_ARRANGE_OUTREACH_ERROR =
  "Facebook Self-Arrange does not support seller outreach. The buyer contacts the seller through Messenger.";

export function facebookSelfArrangeInstructions(preferredDate?: string | null, listingUrl?: string | null): string {
  const message = `Hi, I'm interested in your vehicle and would like to have an independent pre-purchase inspection completed through RideCheck. There is no cost to you as the seller. I'd like to request the inspection for ${preferredDate?.trim() || "a date we agree on"}. Please confirm the inspection date, time, and vehicle address.`;
  return `Facebook Marketplace — Self-Arrange
After completing checkout, send this message to the seller through Messenger:
${message}
Original Facebook listing: ${listingUrl || "Not provided"}
Once the seller confirms, reply to this message with the confirmed date, time, and vehicle address.
Payment and a requested date do not confirm an appointment. RideCheck will not dispatch until the seller confirms.`;
}