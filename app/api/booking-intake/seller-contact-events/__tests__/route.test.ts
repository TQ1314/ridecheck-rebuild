import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ audit: vi.fn(), session: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ writeAuditLog: mocks.audit }));
vi.mock("@/lib/supabase/route-handler", () => ({
  createRouteHandlerSupabaseClient: () => ({ auth: { getSession: mocks.session } }),
}));
vi.mock("@/lib/booking-intake/session", () => ({
  currentIntakeSession: () => "11111111-1111-4111-8111-111111111111",
  createIntakeSession: () => "signed-session",
  verifyIntakeSession: () => "11111111-1111-4111-8111-111111111111",
  setIntakeCookie: vi.fn(),
}));
import { POST } from "../route";

function request(extra: Record<string, unknown> = {}, origin = "https://example.test") {
  return new NextRequest("https://example.test/api/booking-intake/seller-contact-events", {
    method: "POST", headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ listing_url: "https://facebook.com/marketplace/item/123",
      platform_source: "facebook_marketplace", events: ["seller_message_copied"], ...extra }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.audit.mockResolvedValue(undefined);
  mocks.session.mockResolvedValue({ data: { session: null } });
});
describe("Marketplace interaction audit", () => {
  it("uses the existing audit writer and signed intake correlation for guest actions", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "seller_message_copied", actorId: null, actorRole: "guest",
      resourceId: "11111111-1111-4111-8111-111111111111",
      metadata: expect.objectContaining({ source: "facebook_marketplace",
        independently_confirmed: false, evidence_type: "buyer_reported" }),
      throwOnError: true,
    }));
  });
  it("records consent as a report, with actor and server timestamp, not confirmation", async () => {
    mocks.session.mockResolvedValue({ data: { session: { user: { id: "buyer-id", email: "buyer@example.test" } } } });
    expect((await POST(request({ events: ["seller_consent_reported"] }))).status).toBe(200);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "buyer-id", action: "seller_consent_reported",
      metadata: expect.objectContaining({ independently_confirmed: false, timestamp: expect.any(String) }),
    }));
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain("seller_confirmed");
  });
  it("supports the three initial events as one request", async () => {
    await POST(request({ events: ["facebook_marketplace_detected",
      "facebook_concierge_initial_contact_unavailable", "seller_message_displayed"] }));
    expect(mocks.audit).toHaveBeenCalledTimes(3);
  });
  it.each([
    { events: ["inspection_completed"] },
    { events: ["seller_confirmed"] },
    { listing_url: "https://facebook.com/dealer/profile" },
    { listing_url: "https://facebook.com.evil.test/marketplace/item/123" },
  ])("rejects forged/unrelated event data", async (extra) => {
    expect((await POST(request(extra))).status).toBe(400);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("rejects a different request origin", async () => {
    expect((await POST(request({}, "https://evil.test"))).status).toBe(403);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("does not report audit success when storage fails", async () => {
    mocks.audit.mockRejectedValue(new Error("mock database unavailable"));
    expect((await POST(request())).status).toBe(503);
  });
});