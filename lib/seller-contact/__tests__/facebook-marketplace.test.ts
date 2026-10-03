import { describe, expect, it } from "vitest";
import {
  isFacebookMarketplaceListing, isFacebookMarketplaceUrl, emptyFacebookContactState,
  buildFacebookHandoffEvents, FACEBOOK_SELLER_MESSAGE,
} from "../facebook-marketplace";
import { detectSellerPlatform } from "../platforms";
import { createOrderSchema, buildOptionalOrderFields } from "@/app/api/orders/create/contract";

const base = {
  vehicle_year: 2021, vehicle_make: "Toyota", vehicle_model: "Camry",
  vehicle_location: "Waukegan, IL", buyer_phone: "2245550100",
  buyer_email_input: "buyer@example.test", booking_type: "concierge",
  booking_method: "concierge", service_zip: "60085",
};
const consent = { ...emptyFacebookContactState(), seller_consent_reported: true,
  seller_consent_reported_at: "2026-10-02T14:00:00.000Z" };
const facebook = { ...base, listing_url: "https://www.facebook.com/marketplace/item/123",
  facebook_contact: consent };

describe("reliable Marketplace detection", () => {
  it.each([
    "https://www.facebook.com/marketplace/item/123/",
    "https://m.facebook.com/marketplace/item/123?ref=search",
    "https://facebook.com/marketplace/item/456",
    "https://fb.com/marketplace/item/123",
  ])("recognizes %s", (url) => {
    expect(isFacebookMarketplaceUrl(url)).toBe(true);
    expect(detectSellerPlatform(url)).toBe("facebook");
  });
  it.each([
    "https://facebook.com/profile.php?id=1", "https://facebook.com/groups/cars",
    "https://facebook.com/someDealer/posts/123", "https://facebook.com/marketplacefake/item/1",
    "https://facebook.com.evil.test/marketplace/item/123",
    "https://fake-facebook.com/marketplace/item/123",
    "https://facebook.com@evil.test/marketplace/item/123",
    "javascript:alert(1)", "not-a-url",
  ])("does not classify %s as Marketplace", (url) => {
    expect(isFacebookMarketplaceUrl(url)).toBe(false);
    expect(isFacebookMarketplaceListing(url, "facebook_marketplace")).toBe(false);
    expect(detectSellerPlatform(url)).not.toBe("facebook");
  });
  it("allows explicit Marketplace source without a URL", () => {
    expect(isFacebookMarketplaceListing(null, "facebook_marketplace")).toBe(true);
    expect(isFacebookMarketplaceListing(null, "other")).toBe(false);
  });
});

describe("buyer-reported consent contract", () => {
  it("accepts only yes with no seller name/phone/email/address/availability", () => {
    expect(createOrderSchema.safeParse(facebook).success).toBe(true);
  });
  it("requires reported consent on both detected and explicitly selected Marketplace", () => {
    expect(createOrderSchema.safeParse({ ...facebook, facebook_contact: undefined }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, platform_source: "facebook_marketplace" }).success).toBe(false);
  });
  it("rejects an accidental self-arrange/buyer-arranged path for the guided coordination service", () => {
    expect(createOrderSchema.safeParse({ ...facebook, booking_type: "self_arrange" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...facebook, booking_method: "buyer_arranged" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...facebook, booking_method: "self_arrange" }).success).toBe(false);
  });
  it.each(["craigslist", "dealership", "roadside"])("keeps ordinary %s orders valid without new consent", (source) => {
    expect(createOrderSchema.safeParse({ ...base, platform_source: source }).success).toBe(true);
    expect(createOrderSchema.safeParse({ ...base, platform_source: source, booking_type: "self_arrange", booking_method: "self_arrange" }).success).toBe(true);
  });
  it("keeps ordinary Facebook URLs on their original booking path", () => {
    expect(createOrderSchema.safeParse({ ...base, listing_url: "https://facebook.com/dealer/profile" }).success).toBe(true);
  });
  it("saves provided details into existing fields without confirmation/status fields", () => {
    const parsed = createOrderSchema.parse({ ...facebook, seller_email: "seller@example.test",
      seller_available_date: "2026-10-05", seller_available_time: "Afternoon",
      inspection_address: "123 Example Street" });
    const result = buildOptionalOrderFields(parsed, new Set(["seller_email", "seller_available_date",
      "seller_available_time", "inspection_address"]));
    expect(result.error).toBeUndefined();
    expect(result.fields).toMatchObject({ seller_email: "seller@example.test",
      seller_available_date: "2026-10-05", seller_available_time: "Afternoon",
      inspection_address: "123 Example Street" });
    expect(result.fields).not.toHaveProperty("seller_contact_status");
    expect(result.fields).not.toHaveProperty("scheduled_date");
    expect(result.fields).not.toHaveProperty("inspection_completed");
  });
  it("does not require seller storage when no seller details are supplied", () => {
    expect(buildOptionalOrderFields(createOrderSchema.parse(facebook), new Set()).error).toBeUndefined();
  });
  it("fails explicitly instead of silently discarding provided seller details", () => {
    const parsed = createOrderSchema.parse({ ...facebook, seller_email: "seller@example.test" });
    expect(buildOptionalOrderFields(parsed, new Set()).error?.missing_fields).toEqual(["seller_email"]);
  });
  it("uses existing events for consent and flags, without duplicating inspection completion", () => {
    const events = buildFacebookHandoffEvents({ ...consent, seller_message_copied: true,
      facebook_listing_opened: true }, "2026-10-02T14:01:00.000Z", true);
    expect(events.map((event) => event.event_type)).toEqual([
      "facebook_marketplace_detected", "facebook_concierge_initial_contact_unavailable",
      "seller_message_displayed", "seller_message_copied", "facebook_listing_opened",
      "seller_consent_reported", "seller_contact_details_provided",
    ]);
    expect(events[5].details).toMatchObject({ independently_confirmed: false,
      concierge_unavailable_reason: "meta_messaging_restriction",
      seller_consent_reported: true, seller_consent_reported_at: "2026-10-02T14:01:00.000Z" });
    expect(JSON.stringify(events)).not.toContain("inspection_completed");
  });
  it("retains the exact approved seller message", () => {
    expect(FACEBOOK_SELLER_MESSAGE).toBe("Hi, I'm interested in your vehicle and would like to have an independent pre-purchase inspection completed through RideCheck. There is no cost to you as the seller. Are you okay with RideCheck inspecting the vehicle before I make my decision?");
  });
});