import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SellerContactPanel } from "../SellerContactPanel";
import { NextActionPanel } from "../NextActionPanel";

const complete = {
  id: "order-1", booking_type: "self_arrange", listing_source: "online_marketplace",
  listing_url: "https://facebook.com/marketplace/item/123", platform_source: "facebook_marketplace",
  payment_status: "paid", preferred_date: "2026-10-05",
  seller_phone: "+12245550199", seller_email: "seller@example.test",
  seller_contact_status: "confirmed", seller_available_date: "2026-10-05",
  seller_available_time: "14:00", seller_inspection_address: "123 Vehicle Street",
};
function render(order: object) {
  return renderToStaticMarkup(<SellerContactPanel order={order as any} onRefresh={() => {}} />);
}
describe("rendered Ops Facebook Self-Arrange controls", () => {
  it.each(["seller_contact_status", "seller_available_date", "seller_available_time", "seller_inspection_address"])(
    "shows awaiting confirmation with blank %s and preserves the existing confirmation action", (field) => {
      const html = render({ ...complete, [field]: " " });
      expect(html).toContain("Awaiting seller confirmation");
      expect(html).toContain('data-testid="button-mark-seller-confirmed"');
      const assign = html.match(/<button[^>]*data-testid="button-assign-ridechecker"[^>]*>/)?.[0];
      expect(assign).toContain("disabled");
    },
  );
  it("shows complete appointment readiness without exposing seller outreach", () => {
    const html = render(complete);
    expect(html).toContain("appointment dispatch conditions satisfied");
    expect(html).not.toContain('data-testid="button-open-sms-modal"');
    expect(html).not.toContain('data-testid="button-open-email-modal"');
    for (const id of ["button-clickable-phone", "button-clickable-email"]) {
      expect(html.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`))?.[0]).toContain("disabled");
    }
  });
  it("keeps historical Concierge controls visible", () => {
    const html = render({ ...complete, booking_type: "concierge" });
    expect(html).not.toContain('data-testid="facebook-self-arrange-ops"');
    expect(html).toContain('data-testid="button-open-sms-modal"');
  });
  it("renders Next Action as awaiting confirmation rather than ready for assignment", () => {
    const html = renderToStaticMarkup(<NextActionPanel order={{ ...complete, seller_available_time: " " } as any} attemptCount={0} />);
    expect(html).toContain("Awaiting seller confirmation");
    expect(html).toContain("missing confirmed inspection time");
  });
});