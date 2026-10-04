import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  order: {} as any, from: vi.fn(), writes: vi.fn(),
  sendDirect: vi.fn(), sendPreferred: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/rbac", () => ({
  requireRole: async () => ({ actor: { userId: "ops", role: "admin", email: "ops@example.test" } }),
  isAuthorized: () => true, writeAuditLog: vi.fn(async () => {}), writeOrderEvent: vi.fn(async () => {}),
}));
vi.mock("@/lib/notifications/send-preferred", () => ({
  sendDirect: mocks.sendDirect, sendPreferred: mocks.sendPreferred,
}));
vi.mock("@/lib/seller-contact/facebook-coordination.server", () => ({ recordFacebookCoordinationStarted: vi.fn() }));
vi.mock("@/lib/supabase/route-handler", () => ({
  createRouteHandlerSupabaseClient: () => ({ auth: { getSession: async () => ({
    data: { session: { user: { id: "rc-1", email: "rc@example.test" } } },
  }) } }),
}));
vi.mock("@/lib/ridecheckers/eligibility", () => ({
  getRideCheckerAssignmentEligibility: () => ({ eligible: true, blockedReasons: [] }),
}));
vi.mock("@/lib/ridechecker/scorecard", () => ({ emitScoreEvent: vi.fn(async () => {}) }));

import { POST as send } from "@/app/api/admin/orders/[orderId]/seller-contact/send/route";
import { POST as resend } from "@/app/api/admin/delivery-diagnostics/[attemptId]/resend/route";
import { POST as accept } from "@/app/api/ridechecker/jobs/[assignmentId]/accept/route";
import { POST as legacyContact } from "@/app/api/admin/orders/[orderId]/contact-seller/route";

const facebook = {
  id: "order-1", booking_type: "self_arrange", platform_source: "facebook_marketplace",
  listing_url: "https://facebook.com/marketplace/item/123",
  payment_status: "paid", payment_required: true, seller_contact_status: "accepted",
  seller_phone: "+12245550199", seller_email: "seller@example.test",
};
function request(body: object) {
  return new NextRequest("https://example.test/api/action", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.order = { ...facebook };
  mocks.sendDirect.mockResolvedValue({ success: true, messageId: "message-1", channels: ["sms"] });
  mocks.sendPreferred.mockResolvedValue({ success: true, channels: ["sms"] });
  mocks.from.mockImplementation((table: string) => {
    const data = () => table === "orders" ? mocks.order
      : table === "profiles" ? { role: "ridechecker_active", full_name: "RC Test", email: "rc@example.test" }
      : table === "ridechecker_job_assignments" ? {
        id: "assignment-1", order_id: "order-1", status: "awaiting_acceptance",
        expires_at: new Date(Date.now() + 600_000).toISOString(),
      }
      : { id: "attempt-1", order_id: "order-1", attempt_number: 1, delivery_status: "failed",
        channel: "sms", destination: facebook.seller_phone, message_body: "Test", orders: mocks.order };
    const builder: any = {};
    for (const method of ["select", "eq", "in", "is", "limit", "order", "neq"]) builder[method] = () => builder;
    for (const method of ["insert", "update"]) builder[method] = (payload: unknown) => {
      mocks.writes(table, method, payload); return builder;
    };
    builder.single = builder.maybeSingle = async () => ({ data: data(), error: null });
    builder.then = (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject);
    return builder;
  });
});

describe("Facebook Self-Arrange cannot initiate seller outreach", () => {
  it("blocks the legacy Concierge outreach transition without changing status", async () => {
    expect((await legacyContact(request({ contact_method: "sms" }),
      { params: { orderId: "order-1" } })).status).toBe(409);
    expect(mocks.writes).not.toHaveBeenCalled();
    expect(mocks.sendDirect).not.toHaveBeenCalled();
  });
  it.each(["sms", "email"])("blocks manual seller %s without sends or writes", async (channel) => {
    const response = await send(request({
      channel, to: channel === "sms" ? facebook.seller_phone : facebook.seller_email,
      message_body: "Seller outreach",
    }), { params: { orderId: "order-1" } });
    expect(response.status).toBe(409);
    expect(mocks.sendDirect).not.toHaveBeenCalled();
    expect(mocks.writes).not.toHaveBeenCalled();
  });
  it("blocks retrying an existing failed seller notification", async () => {
    expect((await resend(request({}), { params: { attemptId: "attempt-1" } })).status).toBe(409);
    expect(mocks.sendDirect).not.toHaveBeenCalled();
    expect(mocks.writes).not.toHaveBeenCalled();
  });
  it("suppresses automatic seller SMS and email when a RideChecker accepts", async () => {
    expect((await accept(request({}), { params: { assignmentId: "assignment-1" } })).status).toBe(200);
    await vi.waitFor(() => expect(mocks.from).toHaveBeenCalledWith("orders"));
    // Drain the existing non-fatal asynchronous notification task.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.sendDirect).not.toHaveBeenCalled();
  });
  it.each(["concierge", "non-facebook"])("preserves %s manual seller outreach", async (kind) => {
    mocks.order = { ...facebook, booking_type: "concierge",
      ...(kind === "non-facebook" ? { listing_url: null, platform_source: "craigslist" } : {}) };
    expect((await send(request({ channel: "sms", to: facebook.seller_phone, message_body: "Outreach" }),
      { params: { orderId: "order-1" } })).status).toBe(200);
    expect(mocks.sendDirect).toHaveBeenCalled();
  });
  it("retains historical Facebook Concierge notification retries", async () => {
    mocks.order.booking_type = "concierge";
    expect((await resend(request({}), { params: { attemptId: "attempt-1" } })).status).toBe(200);
    expect(mocks.sendDirect).toHaveBeenCalled();
  });
  it("keeps the legacy Concierge outreach transition unchanged", async () => {
    mocks.order.booking_type = "concierge";
    expect((await legacyContact(request({ contact_method: "sms" }),
      { params: { orderId: "order-1" } })).status).toBe(200);
    expect(mocks.writes).toHaveBeenCalledWith("orders", "update", expect.objectContaining({ ops_status: "seller_outreach" }));
  });
  it("retains non-Facebook automatic seller trust messages", async () => {
    mocks.order = { ...facebook, listing_url: null, platform_source: "craigslist" };
    expect((await accept(request({}), { params: { assignmentId: "assignment-1" } })).status).toBe(200);
    await vi.waitFor(() => expect(mocks.sendDirect).toHaveBeenCalledTimes(2));
    expect(mocks.sendDirect.mock.calls.map(([channel]) => channel)).toEqual(["sms", "email"]);
  });
});