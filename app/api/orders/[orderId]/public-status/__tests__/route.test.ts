import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const internalId = "02e671b3-d7b1-4e07-a57b-ee624fab0da6";
const fixture = {
  id: internalId,
  order_number: "RC-1000",
  booking_type: "concierge",
  listing_source: "online_marketplace",
  payment_status: "paid",
  tracking_token: "valid-token",
};

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: fixture, error: null }),
        }),
      }),
    }),
  },
}));

import { GET } from "../route";

describe("private buyer order status", () => {
  it("keeps the UUID as internal ID and returns the separate public reference only with a valid token", async () => {
    const context = { params: { orderId: internalId } };
    const denied = await GET(new NextRequest(`http://localhost/api/orders/${internalId}/public-status?t=wrong`), context);
    expect(denied.status).toBe(403);
    const response = await GET(new NextRequest(`http://localhost/api/orders/${internalId}/public-status?t=valid-token`), context);
    expect(response.status).toBe(200);
    const { order } = await response.json();
    expect(order.id).toBe(internalId);
    expect(order.order_number).toBe("RC-1000");
    expect(order.listing_source).toBe("online_marketplace");
    expect(order.payment_status).toBe("paid");
    expect(order.tracking_token).toBeUndefined();
  });
});