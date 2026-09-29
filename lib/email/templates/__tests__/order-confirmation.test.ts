import { describe, expect, it } from "vitest";
import { orderConfirmationHtml } from "../order-confirmation";

describe("pre-payment customer messaging", () => {
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