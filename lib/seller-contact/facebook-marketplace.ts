import { z } from "zod";

export const FACEBOOK_SELLER_MESSAGE = "Hi, I'm interested in your vehicle and would like to have an independent pre-purchase inspection completed through RideCheck. There is no cost to you as the seller. Are you okay with RideCheck inspecting the vehicle before I make my decision?";
export const FACEBOOK_CONTACT_EXPLANATION = "Facebook requires you to initiate contact with the seller. RideCheck will provide the message and take over coordination once the seller agrees.";
export const FACEBOOK_SOURCE = "facebook_marketplace";
export const FACEBOOK_INITIAL_CONTACT_REASON = "meta_messaging_restriction";

export function isFacebookMarketplaceUrl(value?: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const facebookHost = ["facebook.com", "fb.com"].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      && facebookHost && /^\/marketplace(?:\/|$)/i.test(url.pathname);
  } catch {
    return false;
  }
}

/** A supplied URL takes precedence over the explicit source selection. */
export function isFacebookMarketplaceListing(url?: string | null, source?: string | null): boolean {
  return url?.trim() ? isFacebookMarketplaceUrl(url.trim()) : source === FACEBOOK_SOURCE;
}

export const facebookContactEventSchema = z.enum([
  "facebook_marketplace_detected",
  "facebook_concierge_initial_contact_unavailable",
  "seller_message_displayed",
  "seller_message_copied",
  "facebook_listing_opened",
  "seller_consent_reported",
  "seller_contact_details_provided",
]);
export type FacebookContactEvent = z.infer<typeof facebookContactEventSchema>;
export const facebookContactSchema = z.object({
  seller_message_copied: z.boolean(),
  facebook_listing_opened: z.boolean(),
  seller_consent_reported: z.boolean(),
  seller_consent_reported_at: z.string().datetime().nullable(),
}).strict();
export type FacebookContactState = z.infer<typeof facebookContactSchema>;
export const emptyFacebookContactState = (): FacebookContactState => ({
  seller_message_copied: false,
  facebook_listing_opened: false,
  seller_consent_reported: false,
  seller_consent_reported_at: null,
});

/** Consent remains buyer-reported evidence, never a seller/appointment status. */
export function buildFacebookHandoffEvents(state: FacebookContactState, now: string, hasDetails: boolean) {
  const details = {
    source: FACEBOOK_SOURCE,
    concierge_unavailable_reason: FACEBOOK_INITIAL_CONTACT_REASON,
    seller_message_copied: state.seller_message_copied,
    facebook_listing_opened: state.facebook_listing_opened,
    seller_consent_reported: state.seller_consent_reported,
    seller_consent_reported_at: now,
    buyer_reported_at: state.seller_consent_reported_at,
    independently_confirmed: false,
    origin: "buyer_booking",
  };
  const events: FacebookContactEvent[] = [
    "facebook_marketplace_detected", "facebook_concierge_initial_contact_unavailable",
    "seller_message_displayed",
    ...(state.seller_message_copied ? ["seller_message_copied" as const] : []),
    ...(state.facebook_listing_opened ? ["facebook_listing_opened" as const] : []),
    ...(state.seller_consent_reported ? ["seller_consent_reported" as const] : []),
    ...(hasDetails ? ["seller_contact_details_provided" as const] : []),
  ];
  return events.map((event_type) => ({ event_type, details }));
}