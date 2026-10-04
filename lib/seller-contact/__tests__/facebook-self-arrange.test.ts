import { describe, expect, it } from "vitest";
import { facebookAppointmentError, isFacebookSelfArrange, resolveFacebookBookingType } from "../facebook-self-arrange";
import { getNextAction } from "@/components/orders/NextActionPanel";

const complete = {
  booking_type: "self_arrange", listing_url: "https://facebook.com/marketplace/item/123",
  payment_status: "paid", seller_contact_status: "confirmed",
  seller_available_date: "2026-10-05", seller_available_time: "14:00",
  seller_inspection_address: "123 Vehicle Street",
};

describe("Facebook Self-Arrange routing, appointment evidence and Ops visibility", () => {
  it.each(["concierge", "buyer_arranged", "self_arrange"])("routes Facebook %s to Self-Arrange", (type) => {
    expect(resolveFacebookBookingType(true, type)).toBe("self_arrange");
    expect(resolveFacebookBookingType(false, type)).toBe(type);
  });
  it("accepts complete existing Ops confirmation fields", () => {
    expect(facebookAppointmentError(complete)).toBeNull();
    expect(getNextAction(complete as any, 0).text).toBe("Assign RideChecker");
  });
  it.each([
    ["seller_contact_status", "seller contact confirmation"],
    ["seller_available_date", "confirmed inspection date"],
    ["seller_available_time", "confirmed inspection time"],
    ["seller_inspection_address", "vehicle/inspection address"],
  ])("rejects each missing %s and keeps Ops awaiting confirmation", (key, label) => {
    for (const value of [undefined, null, "", " ", "\n\t"]) {
      const order = { ...complete, [key]: value };
      expect(facebookAppointmentError(order)).toBe(`Appointment not confirmed — missing ${label}.`);
      expect(getNextAction(order as any, 0).text).toBe("Awaiting seller confirmation");
    }
  });
  it("does not substitute paid/requested/reported evidence or city for confirmation", () => {
    const order = { ...complete, seller_contact_status: "accepted", preferred_date: "2026-10-05",
      inspection_address: "Buyer-proposed address", vehicle_location: "Waukegan", seller_consent_reported: true };
    expect(facebookAppointmentError(order)).toContain("seller contact confirmation");
    expect(facebookAppointmentError({ ...order, seller_contact_status: "confirmed", seller_inspection_address: "" }))
      .toContain("vehicle/inspection address");
  });
  it("recognizes explicit Facebook source without URL", () => {
    expect(isFacebookSelfArrange({ booking_type: "self_arrange", platform_source: "facebook_marketplace" })).toBe(true);
  });
  it("keeps payment exemption/override eligibility aligned with the Facebook Ops indicator", () => {
    const order = { ...complete, payment_status: "unpaid", payment_required: false, seller_available_time: "" };
    expect(getNextAction(order as any, 0).text).toBe("Awaiting seller confirmation");
    expect(getNextAction({ ...order, seller_available_time: "14:00" } as any, 0).text).toBe("Assign RideChecker");
  });
  it.each(["concierge", undefined, null])("preserves historical Facebook type %s without reclassification", (booking_type) => {
    const old = { ...complete, booking_type, seller_contact_status: null };
    const snapshot = JSON.stringify(old);
    expect(facebookAppointmentError(old)).toBeNull();
    expect(JSON.stringify(old)).toBe(snapshot);
  });
  it.each(["craigslist", "dealership", "roadside", "auction"])("keeps %s appointment gating unchanged", (source) => {
    const order = { booking_type: "self_arrange", platform_source: source, payment_status: "paid" };
    expect(facebookAppointmentError(order)).toBeNull();
    expect(getNextAction(order as any, 0).text).toBe("Assign RideChecker");
  });
});