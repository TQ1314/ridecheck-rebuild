import { describe, expect, it } from "vitest";
import { orderConfirmationHtml } from "../order-confirmation";

describe("pre-payment customer messaging", () => {
  it("includes Facebook Self-Arrange proposal, requested date, listing and reply instruction", () => {
    const html = orderConfirmationHtml({
      orderNumber: "RC-FB", customerName: "Buyer", vehicleYear: 2021,
      vehicleMake: "Toyota", vehicleModel: "Camry", packageName: "Standard",
      finalPrice: "129", bookingType: "self_arrange", listingSource: "online_marketplace",
      facebookMarketplace: true, preferredDate: "2026-10-05",
      listingUrl: "https://facebook.com/marketplace/item/123",
    });
    expect(html).toContain("2026-10-05");
    expect(html).toContain('href="https://facebook.com/marketplace/item/123"');
    expect(html).toContain("Once the seller confirms, reply to this message with the confirmed date, time, and vehicle address.");
    expect(html).toContain("will not dispatch until the seller confirms");
    expect(html).not.toContain("take over coordination");
    expect(html).not.toContain("before RideCheck contacts the seller");
  });
  it("clearly distinguishes Marketplace buyer initiation from subsequent coordination", () => {
    const html = orderConfirmationHtml({
      orderNumber: "RC-101", customerName: "Buyer", vehicleYear: 2021,
      vehicleMake: "Toyota", vehicleModel: "Camry", packageName: "Standard",
      finalPrice: "139", bookingType: "concierge", listingSource: "online_marketplace",
      facebookMarketplace: true,
    });
    expect(html).toContain("Facebook requires you to initiate contact with the seller.");
    expect(html).toContain("not independently confirm an inspection appointment");
    expect(html).not.toContain("Introduce RideCheck to the seller (optional)");
    expect(html).toContain("Payment is required");
  });
  it("describes a persisted Concierge request as unpaid and not yet confirmed", () => {
    const html = orderConfirmationHtml({
      orderNumber: "RC-100",
      customerName: "Customer",
      vehicleYear: 2023,
      vehicleMake: "Rivian",
      vehicleModel: "R1S",
      packageName: "Exotic",
      finalPrice: "299",
      bookingType: "concierge",
      listingSource: "online_marketplace",
      trackUrl: "/track/sample",
      payUrl: "https://example.test/pay/sample",
    });
    expect(html).toContain("Pending Payment");
    expect(html).toContain("not yet a confirmed inspection");
    expect(html).toContain("before RideCheck contacts the seller");
    expect(html).toContain("https://example.test/pay/sample");
    expect(html).not.toContain("Your order has been created.");
  });
});