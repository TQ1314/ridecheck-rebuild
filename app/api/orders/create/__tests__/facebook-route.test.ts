import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  inserts: [] as { table: string; payload: any }[], eventsUnavailable: false,
  notify: vi.fn(), email: vi.fn(), sms: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: (table: string) => {
    const builder: any = {
      select: () => builder,
      insert: (payload: any) => { mocks.inserts.push({ table, payload }); return builder; },
      update: () => builder, eq: () => builder, is: () => builder,
      limit: () => builder, not: () => builder, neq: () => builder,
      single: async () => ({ data: { id: "new-order", order_number: "RC-TEST", created_at: "2026-10-02T15:00:00Z" }, error: null }),
      then: (resolve: any) => resolve({
        data: [], error: table === "order_events" && mocks.eventsUnavailable ? { message: "table missing" } : null,
      }),
    };
    return builder;
  } },
}));
vi.mock("@/lib/supabase/route-handler", () => ({
  createRouteHandlerSupabaseClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}));
vi.mock("@/lib/geo/resolveCounty", () => ({ PILOT_CONFIG: { enabled: false }, resolveCounty: () => "lake", checkPilotPhase: vi.fn() }));
vi.mock("@/lib/vehicleClassification.server", () => ({ classifyVehicle: () => ({ packageTier: "standard", classificationReason: "Standard" }) }));
vi.mock("@/lib/notifications/order-created-ops", () => ({ notifyNewOrderRequest: mocks.notify }));
vi.mock("@/lib/notifications/email", () => ({ sendEmail: mocks.email }));
vi.mock("@/lib/notifications/sms", () => ({ sendSMS: mocks.sms }));
vi.mock("@/lib/rbac", () => ({ writeAuditLog: mocks.audit }));
vi.mock("@/lib/booking-intake/session", () => ({ currentIntakeSession: () => "intake-test" }));
import { POST } from "../route";

const base = {
  vehicle_year: 2021, vehicle_make: "Toyota", vehicle_model: "Camry",
  vehicle_location: "Waukegan, IL", service_zip: "60085", buyer_phone: "2245550100",
  buyer_email_input: "buyer@example.test", booking_type: "concierge", booking_method: "concierge",
};
const facebook = { ...base, listing_url: "https://facebook.com/marketplace/item/123",
  booking_type: "self_arrange", booking_method: "self_arrange", preferred_date: "2026-10-05",
  facebook_contact: { seller_message_copied: true, facebook_listing_opened: true,
    seller_consent_reported: true, seller_consent_reported_at: "2026-10-02T14:00:00Z" } };
function request(body: object) {
  return new NextRequest("https://example.test/api/orders/create", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.inserts.length = 0;
  mocks.eventsUnavailable = false;
  mocks.email.mockResolvedValue({ success: true, messageId: "mock-email" });
  mocks.sms.mockResolvedValue({ success: true, sid: "mock-sms" });
  mocks.notify.mockResolvedValue(undefined);
  mocks.audit.mockResolvedValue(undefined);
});
describe("Facebook handoff uses canonical unpaid order creation", () => {
  it("allows no seller details, stores separate consent events, and does not activate fulfillment", async () => {
    const response = await POST(request(facebook));
    expect(response.status).toBe(200);
    const order = mocks.inserts.find((insert) => insert.table === "orders")!.payload;
    expect(order).toMatchObject({ platform_source: "facebook_marketplace",
      payment_status: "unpaid", ops_status: "pending_payment", status: "submitted", final_price: 129, booking_type: "self_arrange" });
    expect(order).not.toHaveProperty("seller_contact_status");
    expect(order).not.toHaveProperty("seller_confirmed_at");
    expect(order).not.toHaveProperty("inspection_completed");
    const events = mocks.inserts.find((insert) => insert.table === "order_events")!.payload;
    expect(events.some((event: any) => event.event_type === "seller_consent_reported")).toBe(true);
    expect(events.every((event: any) => event.details.independently_confirmed === false)).toBe(true);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });
  it("reuses authoritative seller/email/address/availability columns when supplied", async () => {
    await POST(request({ ...facebook, seller_name: "Seller", seller_phone: "2245550101",
      seller_email: "seller@example.test", inspection_address: "123 Example Street",
      seller_available_date: "2026-10-05", seller_available_time: "Afternoon" }));
    expect(mocks.inserts.find((insert) => insert.table === "orders")!.payload).toMatchObject({
      seller_name: "Seller", seller_phone: "2245550101", seller_email: "seller@example.test",
      inspection_address: "123 Example Street", seller_available_date: "2026-10-05",
      seller_available_time: "Afternoon",
    });
  });
  it("allows booking before seller confirmation without fabricating an appointment", async () => {
    expect((await POST(request({ ...facebook, facebook_contact: undefined }))).status).toBe(200);
    const order = mocks.inserts.find((insert) => insert.table === "orders")!.payload;
    expect(order).not.toHaveProperty("seller_contact_status");
    expect(order).not.toHaveProperty("seller_available_date");
  });
  it.each([undefined, null, "", "   "])("rejects missing requested date %s before mutation", async (preferred_date) => {
    expect((await POST(request({ ...facebook, preferred_date }))).status).toBe(400);
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("rejects new Facebook Concierge orders before mutation", async () => {
    expect((await POST(request({ ...facebook, booking_type: "concierge", booking_method: "concierge" }))).status).toBe(400);
    expect(mocks.inserts).toHaveLength(0);
  });
  it("sends instructions only to the buyer, including requested date and original listing", async () => {
    await POST(request({ ...facebook, seller_email: "seller@example.test", seller_phone: "2245550199" }));
    expect(mocks.sms).toHaveBeenCalledTimes(1);
    expect(mocks.email).toHaveBeenCalledTimes(1);
    for (const [notification] of mocks.sms.mock.calls) {
      expect(notification.to).not.toBe("2245550199");
      expect(notification.body).toContain("2026-10-05");
      expect(notification.body).toContain(facebook.listing_url);
      expect(notification.body).toContain("Once the seller confirms, reply to this message with the confirmed date, time, and vehicle address.");
    }
    expect(mocks.email.mock.calls[0][0].to).toBe("buyer@example.test");
    expect(mocks.email.mock.calls[0][0].html).toContain("2026-10-05");
    expect(mocks.email.mock.calls[0][0].html).toContain(facebook.listing_url);
  });
  it("detects unavailable consent storage before creating an order", async () => {
    mocks.eventsUnavailable = true;
    expect((await POST(request(facebook))).status).toBe(503);
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it.each(["craigslist", "dealership", "roadside"])("leaves %s creation on its unchanged path", async (source) => {
    expect((await POST(request({ ...base, platform_source: source }))).status).toBe(200);
    expect(mocks.inserts.some((insert) => insert.table === "order_events")).toBe(false);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});