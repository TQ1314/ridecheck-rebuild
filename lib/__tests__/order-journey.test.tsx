import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OrderSummaryRow } from "@/components/order-journey/OrderSummaryRow";
import {
  isMarketplaceConcierge, isSelfArranged, publicOrderReference, sellerIntroduction,
  PURCHASE_DECISION_ACKNOWLEDGMENT,
} from "@/lib/order-journey";
import { orderConfirmationHtml } from "@/lib/email/templates/order-confirmation";
import { t } from "@/lib/i18n/translations";

const base = {
  orderNumber: "RC-1000",
  customerName: "Buyer",
  vehicleYear: 2017,
  vehicleMake: "Audi",
  vehicleModel: "Q7",
  packageName: "Basic",
  finalPrice: "139",
  bookingType: "concierge",
  listingSource: "online_marketplace",
  trackUrl: "/track/internal-uuid?t=private-token",
  payUrl: "https://example.com/pay/internal-uuid?t=private-token",
};

describe("buyer journey copy and references", () => {
  it("uses the existing public reference, never repurposing an internal UUID", () => {
    const id = "02e671b3-d7b1-4e07-a57b-ee624fab0da6";
    expect(publicOrderReference("RC-1000")).toBe("Order #RC-1000");
    expect(publicOrderReference(null)).toBeNull();
    const html = orderConfirmationHtml(base);
    expect(html).toContain("Order #RC-1000");
    expect(html).not.toContain(`Order ID</td><td>${id}`);
    expect(html).not.toContain("Order ID");
    // Internal IDs remain in private links, not visible order-reference labels.
    expect(base.trackUrl).toContain("internal-uuid");
  });

  it("keeps Concierge payment-first and makes marketplace introduction optional with confirmed vehicle details", () => {
    const html = orderConfirmationHtml(base);
    expect(html).toContain("Payment must be confirmed before RideCheck contacts the seller or schedules the inspection.");
    expect(html).toContain("not yet a confirmed inspection");
    expect(html).toContain("Once payment is completed, RideCheck will begin coordinating with the seller");
    expect(html).toContain("Introduce RideCheck to the seller (optional)");
    expect(html).toContain("the 2017 Audi Q7");
    expect(isMarketplaceConcierge({ booking_type: "concierge", listing_source: "online_marketplace" })).toBe(true);
    expect(orderConfirmationHtml({ ...base, listingSource: "dealership" })).not.toContain("Introduce RideCheck");
  });

  it("assigns seller coordination to both canonical self-arrange variants", () => {
    for (const type of ["self_arrange", "buyer_arranged"]) {
      expect(isSelfArranged(type)).toBe(true);
      const html = orderConfirmationHtml({ ...base, bookingType: type });
      expect(html).toContain("You coordinate access and timing with the seller");
      expect(html).not.toContain("RideCheck will begin coordinating with the seller");
      expect(html).not.toContain("Introduce RideCheck to the seller (optional)");
    }
  });

  it("does not invent missing year/make/model in the introduction", () => {
    const message = sellerIntroduction({ vehicle_year: null, vehicle_make: null, vehicle_model: null });
    expect(message).toContain("the vehicle");
    expect(message).not.toContain("undefined");
    expect(message).not.toContain("null");
    expect(sellerIntroduction({ vehicle_year: 2017, vehicle_make: null, vehicle_model: "Q7" }))
      .toContain("the 2017 Q7");
  });

  it("preserves the required purchase-decision acknowledgment and exact Review payment copy", () => {
    expect(PURCHASE_DECISION_ACKNOWLEDGMENT).toBe(
      "I understand the RideCheck report is one source of information to help me make an informed purchase decision, and the final purchase decision remains mine."
    );
    expect(t("booking.paymentFirst")).toBe(
      "After you submit your request, we'll send you a secure payment link. Payment is required before RideCheck contacts the seller or schedules the inspection."
    );
    expect(t("booking.conciergeNote")).not.toContain("seller confirms");
  });

  it("keeps labels apart from long values on narrow order summaries", () => {
    const html = renderToStaticMarkup(
      <OrderSummaryRow label="Vehicle" testId="text-vehicle">2017 Audi Q7 Premium Plus</OrderSummaryRow>
    );
    expect(html).toContain("gap-3");
    expect(html).toContain("shrink-0");
    expect(html).toContain("break-words");
    expect(html).toContain("text-right");
    expect(html).toContain("Vehicle</span>");
  });
});